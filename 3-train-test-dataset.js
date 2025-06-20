var datasetYear    = 2023;
var datasetVersion = '4_CONTINENTAL';
var classID        = 31;

var supervisedImg  = ee.Image('projects/solved-mb10/assets/public/LANDSAT/AQUACULTURE/'+datasetYear+'-'+datasetVersion+'_SUPERVISEDMASK_FULL').eq(classID).unmask(0).toByte();
var trainingPolys  = ee.FeatureCollection('projects/solved-mb10/assets/public/LANDSAT/AQUACULTURE/geom_train_TF' + datasetVersion + '_FULL_CONT_LITORAL');
var evalPolys      = ee.FeatureCollection('projects/solved-mb10/assets/public/LANDSAT/AQUACULTURE/geom_eval_TF'+ datasetVersion +'_FULL_CONT_LITORAL');

var polyImage = ee.Image(0).byte().paint(trainingPolys, 1).paint(evalPolys, 2);
polyImage     = polyImage.updateMask(polyImage);

var datasetMosaic = ee.Image('projects/ee-project/assets/USER_PATH/mosaic_'+ datasetYear);

Map.addLayer(datasetMosaic,{bands:['swir1','nir','red'],min:0,max:140},'Initial Mosaic '+datasetYear);
Map.addLayer(supervisedImg.selfMask(),{'palette':'purple'},'supervised layer '+datasetYear);
Map.addLayer(polyImage,{'min': 1, 'max': 4, 'palette': ['red', 'blue','#ffcccb',' #87C1FF']},'Shapes', false);