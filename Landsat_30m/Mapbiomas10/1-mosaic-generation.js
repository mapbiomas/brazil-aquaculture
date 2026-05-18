var getImageCollection = function(studyArea,startDate,endDate){
  var ls, l5TOAs, l7TOAs, l8TOAs, l9TOAs;
  
  var sensorBandDictLandsatTOA = ee.Dictionary({
                        L9 : ee.List([1,2,3,4,5,6,'QA_PIXEL']),
                        L8 : ee.List([1,2,3,4,5,6,'QA_PIXEL']),
                        L7 : ee.List([0,1,2,3,4,"B7",'QA_PIXEL']),
                        L5 : ee.List([0,1,2,3,4,6,'QA_PIXEL'])
  });
  var bandNamesLandsatTOA = ee.List(['blue','green','red','nir','swir1','swir2','BQA']);

  l5TOAs = ee.ImageCollection('LANDSAT/LT05/C02/T1_TOA')
      .filterDate(startDate,endDate)
      .filterBounds(studyArea)
      .select(sensorBandDictLandsatTOA.get('L5'),bandNamesLandsatTOA);
  l7TOAs = ee.ImageCollection('LANDSAT/LE07/C02/T1_TOA')
      .filterDate(startDate,endDate)
      .filterBounds(studyArea)
      .select(sensorBandDictLandsatTOA.get('L7'),bandNamesLandsatTOA);
  
  l8TOAs = ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
      .filterDate(startDate,endDate)
      .filterBounds(studyArea)
      .select(sensorBandDictLandsatTOA.get('L8'),bandNamesLandsatTOA);
 l9TOAs = ee.ImageCollection('LANDSAT/LC09/C02/T1_TOA')
      .filterDate(startDate,endDate)
      .filterBounds(studyArea)
      .select(sensorBandDictLandsatTOA.get('L9'),bandNamesLandsatTOA);

  if(year < 2014){
    ls = ee.ImageCollection(l5TOAs.merge(l7TOAs).merge(l8TOAs));
  }else{
    ls = ee.ImageCollection(l8TOAs).merge(l9TOAs);
  }
  return ls
}

var bqaFunction = function(image){
  var dilatedCloud = 1 << 1;
  var cloud        = 1 << 3;
  var shadown      = 1 << 4;
  var qa           = image.select('BQA');
  var mask         = qa.bitwiseAnd(dilatedCloud).or(qa.bitwiseAnd(cloud)).or(qa.bitwiseAnd(shadown));
  return image.updateMask(mask.not());
}

var createIndexs = function(image) {
  var MNDWI,NDVI,NDWI,MMRI,NDSI;

  NDVI = image.expression(
    '(((banda4 - banda3)/(banda4 + banda3)))', {
      'banda4': image.select('nir'),
      'banda3': image.select('red')
  }).rename('NDVI');
  NDSI = image.expression(
    '(((banda5 - banda4)/(banda4 + banda5)))', {
      'banda5': image.select('swir1'),
      'banda4': image.select('nir')
  }).rename('NDSI');
  NDWI = image.expression(
    '((banda2 - banda4)/ (banda4 + banda2))', {
      'banda2' : image.select('green'),
      'banda4' : image.select('nir')
  }.rename('NDWI'));
  MNDWI = image.expression(
    '((( banda2 - banda5) / (banda2 + banda5)))', {
      'banda2': image.select('green'),
      'banda5': image.select('swir1'),
  }).rename('MNDWI');
  MMRI = image.expression(
    '(abs(MNDWI)-abs(NDVI))/(abs(MNDWI) + abs(NDVI))', {
      'MNDWI': MNDWI,
      'NDVI': NDVI,
  }).rename('MMRI');
  return  image.addBands([NDVI,MNDWI,NDSI,NDWI,MMRI]);
};


/// Main CODE
var userEEProject='USER_PROJECT_ID'
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

var year      = 2024;
var startDate = year+'-01-01';
var endDate   = (year+1)+'-01-01';

var mosaicMerge = getImageCollection(ROI,startDate,endDate).map(createIndexs).map(bqaFunction);
var mosaic      = mosaicMerge.median();
var mosaicNew   = mosaic.select(['blue','green','red','nir','swir1','swir2','BQA']).multiply(255);
mosaicNew       = mosaicNew.addBands(mosaic.select(['NDVI','MNDWI','MMRI','NDSI','NDWI']).add(1).multiply(127));

Map.addLayer(mosaicNew,{},'Mosaic '+year, false)

Export.image.toAsset({
  image:mosaicNew.toByte().set({'year':year,'mosaic':1}),
  description: 'Mosaic_'+year,
  assetId:'projects/'+userEEProject+'/assets/USER_PATH/mosaic_'+year,
  region:ROI,
  scale:30,
  maxPixels:1e13
})
