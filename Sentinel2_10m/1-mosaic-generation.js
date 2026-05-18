import { rois, geometry_br} from './regions.js';

function createIndexs(image){
    var NDVI = image.expression('(((banda4 - banda3)/(banda4 + banda3)))', {'banda4': image.select('nir'),'banda3': image.select('red')});
    var NDSI = image.expression('(((banda5 - banda4)/(banda4 + banda5)))', {'banda5': image.select('swir1'),'banda4': image.select('nir')});
    var NDWI = image.expression('((banda2 - banda4)/ (banda4 + banda2))', {'banda2' : image.select('green'),'banda4' : image.select('nir')});
    var MNDWI = image.expression('((( banda2 - banda5) / (banda2 + banda5)))', {'banda2': image.select('green'),'banda5': image.select('swir1')});
    var MMRI = image.expression('(abs(MNDWI)-abs(NDVI))/(abs(MNDWI) + abs(NDVI))', {'MNDWI': MNDWI,'NDVI': NDVI});
    
    
    var totalPhosphorus = image.expression(
      '2.71828**(-0.4081 -8.659*(1/(B3/B2)))', {
        'B2': image.select('green'),
        'B3': image.select('red')
    });
    var totalNitrate = image.expression(
      '2.71828**(8.228-2.713*(1/(B3+B2)))', {
        'B2': image.select('green'),
        'B3': image.select('red')
    });
    var maskedImage = image
      .addBands(NDVI.rename('NDVI'))
      .addBands(MNDWI.rename('MNDWI'))
      .addBands(NDSI.rename('NDSI'))
      .addBands(NDWI.rename('NDWI'))
      .addBands(MMRI.rename('MMRI'))
      .addBands(totalNitrate.rename('IM1'))
      .addBands(totalPhosphorus.rename('IM2'));
    return  maskedImage}

function createS2Mosaic( year, optical_bands,optical_indeces, rois_for_percentile){
    var s2Sr     = ee.ImageCollection("COPERNICUS/S2_HARMONIZED");
    var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY');

    var START_DATE = ee.Date((year)+'-01-01');
    var END_DATE   = ee.Date((year+1)+'-01-01');
    var MAX_CLOUD_PROBABILITY = 50;

    function maskClouds(img){
        var clouds = ee.Image(img.get('cloud_mask')).select('probability');
        var isNotCloud = clouds.lt(MAX_CLOUD_PROBABILITY);
        return img.updateMask(isNotCloud)}
        


    function maskEdges(s2_img){
        return s2_img.updateMask(s2_img.select('red_edge_4').mask().updateMask(s2_img.select('water_vapor').mask()))}
    
    s2Sr = s2Sr.filterBounds(geometry_br).filterDate(START_DATE, END_DATE).select(ee.List([1,2,3,7,'B11','B12','B8A','B9']),ee.List(['blue','green','red','nir','swir1','swir2','red_edge_4','water_vapor'])).map(maskEdges);
    s2Clouds = s2Clouds.filterBounds(geometry_br).filterDate(START_DATE, END_DATE);
    var s2SrWithCloudMask = ee.Join.saveFirst('cloud_mask').apply({primary:s2Sr,secondary:s2Clouds, condition:ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})   });
    var s2CloudMasked = ee.ImageCollection(s2SrWithCloudMask).map(maskClouds).map(createIndexs).mean();
    


    var s2CloudMaskedOptical = s2CloudMasked.select(optical_bands);
    
    var pdf = s2CloudMaskedOptical.reduceRegions({reducer: ee.Reducer.percentile([5,95]).unweighted(), collection: rois_for_percentile, scale: 10, maxPixelsPerRegion:1e30});
    var list_selectors_percentiles = ['blue_p5','green_p5','red_p5','nir_p5','swir1_p5','blue_p95','green_p95','red_p95','nir_p95','swir1_p95'];
    var sel_length = list_selectors_percentiles.length;
    var pdf_minmax = pdf.reduceColumns({reducer: ee.Reducer.minMax().repeat(sel_length),selectors:list_selectors_percentiles});

    var min = ee.List(ee.Dictionary(pdf_minmax).get('min')).slice(0,(sel_length/2),1);
    var max = ee.List(ee.Dictionary(pdf_minmax).get('max')).slice((sel_length/2),sel_length,1);
    max = ee.Dictionary.fromLists(optical_bands, max);
    min = ee.Dictionary.fromLists(optical_bands, min);

    var normalizationExp  = '(band - min) / (max - min)';
    var normalized_mosaic_optical = ee.ImageCollection.fromImages(s2CloudMaskedOptical.bandNames().map(function(name){
        name     = ee.String(name);
        var band = s2CloudMaskedOptical.select(name);
        var normalized_band = band.expression({
          expression: normalizationExp,
          map: {
            band: band,
            max: ee.Number(max.get(name)),
            min: ee.Number(min.get(name)),
          }
        });
        
        return normalized_band.clamp(0,1);
    })).toBands().rename(s2CloudMaskedOptical.bandNames());
    
    s2CloudMasked = s2CloudMasked;
    normalized_mosaic_optical  = normalized_mosaic_optical.multiply(255).toByte(); //only optical bands. Now in utin8

    var mosaic_optical = normalized_mosaic_optical.select(optical_bands);
    var mosaic_final   = mosaic_optical.addBands(s2CloudMasked.select(optical_indices).add(1).multiply(127));
    return mosaic_final.toByte();
}


/// Main CODE
var userEEProject   = 'USER_PROJECT_ID';
var userPATH        = 'USER_PATH';
var year            = 2024;
var optical_bands   = ['blue','green','red','nir','swir1',];
var optical_indices = ['NDVI','MNDWI','MMRI'];
var dict_biome      = {1:{str:'amazonia', CD_Bioma:1 },2:{str:'caatinga', CD_Bioma:2},3:{str:'cerrado', CD_Bioma:3},
                        4:{str:'mata_atlantica', CD_Bioma:4 },5:{str:'pampa', CD_Bioma:5},6:{str:'pantanal', CD_Bioma:6}
};
for(var biome_id= 1;biome_id<7;biome_id++){
  var cur_biome = ee.FeatureCollection('.../Biomas_250mil_buffer_one_tenth_degree').filter(ee.Filter.eq('CD_Bioma',biome_id)).first().geometry();
  var cur_str = dict_biome[biome_id].str;
  Map.addLayer(cur_biome,{},'bioms '+cur_str,false);
  
  var biome_mosaic_s2 = createS2Mosaic(year,optical_bands,optical_indices, rois);  
  var br_for_clip = ee.Image.constant(0).paint(cur_biome,1).reproject(biome_mosaic_s2.projection().crs(),null, 10);
  biome_mosaic_s2 = biome_mosaic_s2.updateMask(br_for_clip);
  
  Map.addLayer(biome_mosaic_s2.select('swir1'),{},''+cur_str, false);
  Export.image.toAsset({
    image:biome_mosaic_s2.toByte().set({'year':year,'mosaic':1,'satellite':'sentinel2','biome':cur_str}),
    description: 'Mosaic_Sentinel2_'+year+'-'+cur_str,
    assetId:'projects/'+userEEProject+'/assets/'+ USER_PATH +'/mosaic_'+year+'-'+cur_str,
    region:cur_biome.bounds(),
    scale:10,
    maxPixels:1e13
  });
}