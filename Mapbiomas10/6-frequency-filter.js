/** 
* @Author Luiz Cortinhas
* @Version 1
* @Note this function aims load the temporal filtered images into a single image collection
* @Return ee.ImageCollection
**/
// Set nextyear as apropertie in each img in a imagecollection
var getImageCollection = function(firstYear, lastYear, userEEProject, versionSF){
  var fs     = ee.ImageCollection('projects/'+userEEProject+'/assets/LANDSAT/AQUACULTURE/unet_fs').filter(ee.Filter.and(ee.Filter.eq('version',versionSF)));
  var images = ee.List([]);
  for(var year = firstYear; year <= lastYear; year++){
    var img = fs.filter(ee.Filter.eq('year',year)).first()

    if(year == firstYear){
      img = img.set({'nextYear':(year-1)});
    }else{
      img = img.set({'nextYear':(year+1)});
    }
    images = images.add(img);
  }
  return ee.ImageCollection(images);
};

/**
* @Author Luiz Cortinhas
* @Version 1
* @Note this function aims calculate the consecutive mask to avoid true positives to be removed,
* @Return ee.ImageCollection
**/
var getConsecutively = function(img){
    var yearRef = img.get('nextYear');
    var yearN1 = ee.Image(copyIMC.filterMetadata('year','equals',yearRef).mosaic());
    //var yearN2 = imc.filterMetadata('year','equals',yearRef+2).mosaic() // To be used in the future
    var consecutive = ee.Image(0).toByte().where(img.eq(yearN1),1);
    return img.addBands(consecutive.rename('consecutiveness'));
};

/**
* @Author Luiz Cortinhas
* @Version 1
* @Note this function aims apply the desired frequency filter to binarized image collection,
* @Return ee.ImageCollection
**/
var filterPixelFrequency = function(firstYear, lastYear, imc, cutPercentage, classID){
  var temporalSeries = (lastYear - firstYear) + 1; //quantity years
  var imcFreq        = imc.map(function(e){ return e.select('classification').eq(classID)}).sum().divide(temporalSeries).multiply(100); //Frequency Image
  var filteredImages = ee.List([]);
  Map.addLayer(imcFreq,{min:0,max:100,palette:['fff9f9','ff0000','efff00','27ff00','ef00ff']},'Freq - ' + classID, false);
  for(var i = firstYear; i <= lastYear; i++){
    var image       = imc.filterMetadata('year','equals',i).first();
    image           = image.updateMask(image.select('classification').eq(classID)).where(imcFreq.lte(cutPercentage),0);
    filteredImages  = filteredImages.add(image);
  }
  var imcFreqPos = ee.ImageCollection(filteredImages).map(function(e){ return e.select('classification').eq(classID)}).sum().divide(temporalSeries).multiply(100); //Frequency Image
  var imgMapAddLayer = imcFreqPos.updateMask(imcFreqPos.neq(0));

  Map.addLayer(imcFreqPos.updateMask(imcFreqPos.neq(0)),{min:0,max:100,palette:['fff9f9','ff0000','efff00','27ff00','ef00ff']},'Pós Filtro Freq - ' + classID, false);

  return [filteredImages, imgMapAddLayer];
};

/// Main CODE
var ROI = ee.Geometry.Polygon(
  [
      [
          [-75.46319738935682, 6.627809464162168],
          [-75.46319738935682, -34.62753178950752],
          [-32.92413488935683, -34.62753178950752],
          [-32.92413488935683, 6.627809464162168]
      ]
  ], null, false
);
var userEEProject ='USER_PROJECT_ID';
var versionSF     = 6;
var firstYear = 1985;
var lastYear  = 2024;


var classID   = 31;
var versionFF = 1;
var frequency = 10;
var imc     = getImageCollection(firstYear, lastYear, userEEProject, versionSF);
var copyIMC = imc;
var year    = 2024;


var mosaic_image_full = ee.Image('projects/'+userEEProject+'/assets/USER_PATH/mosaic_'+year);
Map.addLayer(mosaic_image_full, {'bands': ['swir1', 'nir', 'red'],'min': 5,'max': 109,'opacity':1},'mosaico landsat '+year,true);


imc                 = imc.map(getConsecutively).aside(print);
var targetClassList = filterPixelFrequency(firstYear, lastYear, imc,frequency,classID);
var targetClass     = ee.ImageCollection(targetClassList[0]);
var imgMapAddLayer  = targetClassList[1];


for(var year = firstYear; year <= lastYear; year++){
    var image = targetClass.filterMetadata('year','equals',year).first().unmask(0).updateMask(targetClass.filterMetadata('year','equals',year).first().neq(0));
    Map.addLayer(image,{bands:['classification'],min:0,max:31},year+' - Filtered',false);
    Export.image.toAsset({
        image: image.select('classification').toByte().set({'classification':4,'class':classID,'year':year,'filter':3,'version':versionFF,'region':'BR','frequency':frequency,'epochs':64,'boundary':127.5}).toByte(),
        description:year + '-' + versionFF+'-FF',
        assetId:'projects/'+userEEProject+'/assets/LANDSAT/AQUACULTURE/unet_ff/' + year + '-' + versionFF,
        scale: 30,
        maxPixels:1e13,
        region: ROI
    });
}
