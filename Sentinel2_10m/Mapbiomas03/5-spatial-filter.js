var classID       = 31;
var class_version = 1;
var ft_version    = 1;
var ft_mode       = 'max';
var scale         = 10;


var userEEProject = 'USER_PROJECT_ID';
var userPATH      = 'USER_PATH';

var imageVisParam = {"opacity":1,"bands":["swir1","nir","red"],"min":1,"max":180,"gamma":1};

var grids_from_mb8 = [1723, 1773, 1822, 2127, 2177, 2178, 2224, 2227, 2271, 2307, 2318, 2322, 2513, 838,1672, 1720, 1823, 2128, 2256, 2270, 2272, 2273, 2274, 2308, 2517, 2517];
var delete_id      = 3064;

var grid = ee.FeatureCollection('projects/'+ userEEProject +'/assets/GRID-ALLCALSSES-COL9-STACK')
            .filter(ee.Filter.or(ee.Filter.eq('aqua',1), ee.Filter.inList('id', grids_from_mb8)));
grid     = grid.filter(ee.Filter.and(ee.Filter.neq('id', delete_id)));



var getData = function(year, ft_mode, ft_version, class_version){
  return   ee.ImageCollection('projects/'+ userEEProject +'/assets/SENTINEL2/AQUACULTURE/unet_ft')
                   .filter(ee.Filter.and(ee.Filter.eq('year',year), ee.Filter.eq('mode',ft_mode), ee.Filter.eq('filter',ft_version), ee.Filter.eq('version',class_version)))
                   .first().eq(classID).unmask(0).unmask(0).remap([0,1],[0,classID]).rename('classification');
};



var PostClassification = function (image) {
  this.init = function (image) {
    this.image = image;
  };

  var majorityFilter = function (image, params) {
    params = ee.Dictionary(params);
    var maxSize = ee.Number(params.get('maxSize')); 
    var classValue = ee.Number(params.get('classValue'));
    var classMask = image.eq(classValue);
    var labeled = classMask.mask(classMask).connectedPixelCount(maxSize, true);
    var region = labeled.lt(maxSize); //<5 [1-4]

    var kernel = ee.Kernel.square(1);
    var neighs = image.neighborhoodToBands(kernel).mask(region);
    var majority = neighs.reduce(ee.Reducer.mode());

    var filtered = image.where(region, majority);

    return filtered.byte();

  };

  /**
   * Reclassify small blobs of pixels  
   * @param  {list<dictionary>} filterParams [{classValue: 1, maxSize: 3},{classValue: 2, maxSize: 5}]
   * @return {ee.Image}  Filtered Classification Image
   */
  this.spatialFilter = function (filterParams) {

    var image = ee.List(filterParams)
    /**
     * Iterate an algorithm over a list. The algorithm is expected to take two objects, 
     * the current list item, and the result from the previous iteration or the value of first for the first iteration(in this case this.image)
     */
      .iterate(
        function (params, image) {
          return majorityFilter(ee.Image(image), params);
        },
        this.image
      );
    this.image = ee.Image(image);
    return this.image;
  };
  this.init(image);
};


//------------------------------------ Main CODE --------------------------------------
import {geometry_br,del_filter_fs, add_filter_fs, kmeans_filter_fs, kpoi_filter_fs} from './regions.js';

var years        = ee.List.sequence(2016, 2024, 1);
var filterParams = [{classValue: classID, maxSize: 100}];

var max = years.map(function(year){
  var ft_data  = getData(year, ft_mode, ft_version, class_version);
  return ee.Image(ft_data).set('year',year);
});
max = ee.ImageCollection(max)


var filtered = years.map(function(year){
  var ft_data  = getData(year, ft_mode, ft_version, class_version);
  var pc       = new PostClassification(ft_data);
  var filtered = pc.spatialFilter(filterParams);  
  return ee.Image(filtered).set('year',year).reproject('EPSG:4326', null, scale);
});
filtered = ee.ImageCollection(filtered)



var add_img_mask  = ee.Image.constant(0).paint(add_filter_fs, classID).reproject(filtered.first().projection().crs(), null, scale).rename('classification');
var clip_img_mask = ee.Image.constant(1).paint(del_filter_fs, 0).reproject(filtered.first().projection().crs(), null, scale).rename('classification');

var version = 1

for (var year_ = 2016; year_ <2025;year_++){
  var cur_img = filtered.filter(ee.Filter.eq('year',year_)).first().selfMask();
  
  cur_img = cur_img.updateMask(clip_img_mask);  
  
  var mosaic_image = ee.ImageCollection('projects/'+userEEProject+'/assets/'+userPATH).filter(ee.Filter.and(ee.Filter.eq('mosaic',1),ee.Filter.eq('year',year_))).mosaic();
  var mask_k      = ee.Image.constant(0).paint(kmeans_filter_fs.union(),1).reproject(mosaic_image.projection().crs(), null, scale);
  var ROI_k       = mosaic_image.mask(mask_k);
  var samples     = ROI_k.sample(kmeans_filter_fs.geometry(0.1),scale,null,null,30000,1,true,1,true);
  var cluster     = ee.Clusterer.wekaKMeans({init:1,nClusters:3,fast:false,seed:44}).train(samples.limit(10000), ['MNDWI','swir1']);
  var clusterized = ROI_k.cluster(cluster);
  
  var clusterID = clusterized.reduceRegion(ee.Reducer.first(),kpoi_filter_fs,scale).get('cluster').getInfo();
  var targetCluster = clusterized.eq(clusterID).unmask(0);
  
  var new_supervised = ee.Image(0).where(targetCluster.eq(1),1).rename('classification').mask(mask_k);
  var current_img = cur_img.unmask(0).where(new_supervised.eq(1),classID);
  current_img = current_img.where(add_img_mask.eq(classID),classID);
  current_img = current_img.clip(grid);
  

  Export.image.toAsset({
    image:current_img.select('classification').toByte().set({'class':classID,'year':year_,'version':version,'region':'BR', 'filter':2,'unet_version':'v1_CONTINENTAL_512','collection':10,'mode':ft_mode}).toByte(),
    description:year_+'-'+version+'-'+ft_mode+'-fs',
    assetId:'projects/'+userEEProject+'/assets/SENTINEL2/AQUACULTURE/unet_fs/'+year_+'-'+version+'-'+ft_mode+'-fs',
    scale:scale,
    maxPixels:1e13,
    region: geometry_br
  });
}
