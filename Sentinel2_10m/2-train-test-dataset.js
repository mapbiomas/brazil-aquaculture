import {notRSBox} from './regions.js';

var userEEProject   = 'USER_PROJECT_ID';
var userPATH        = 'USER_PATH';

var datasetYear     = 2023;
var datasetVersion  = '4_CONTINENTAL';
var supervisedImg   = ee.Image('projects/solved-mb10/assets/SENTINEL2/AQUACULTURE/Supervised_mask/'+datasetYear+'-1-supervised_mask-no-RS').gte(1).unmask(0).toByte();

var trainingPolys   = ee.FeatureCollection('projects/solved-mb10/assets/public/LANDSAT/AQUACULTURE/geom_train_TF' + datasetVersion + '_FULL_CONT_LITORAL');
var evalPolys       = ee.FeatureCollection('projects/solved-mb10/assets/public/LANDSAT/AQUACULTURE/geom_eval_TF'+ datasetVersion +'_FULL_CONT_LITORAL');
trainingPolys       = trainingPolys.filter(ee.Filter.bounds(notRSBox).not());
evalPolys           = evalPolys.filter(ee.Filter.bounds(notRSBox).not());

var polyImage       = ee.Image(0).byte().paint(trainingPolys, 1).paint(evalPolys, 2);
polyImage           = polyImage.updateMask(polyImage);

var datasetMosaic   = ee.Image('projects/'+userEEProject+'/assets/'+userPATH).filter(ee.Filter.and(ee.Filter.eq('mosaic',1),ee.Filter.eq('year',datasetYear))).mosaic();

Map.addLayer(datasetMosaic,{min:4, max:188, bands:['swir1','nir','red']},'Mosaico SENTINEL '+datasetYear);
Map.addLayer(supervisedImg.selfMask(),{'palette':'#601f9e'},'supervised S2 '+datasetYear, false);
Map.addLayer(polyImage,{'min': 1, 'max': 4, 'palette': ['red', 'blue','#ffcccb',' #87C1FF']},'Shapes', false);