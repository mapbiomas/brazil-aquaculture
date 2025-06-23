/** 3.1.2 Use the mapbiomas spatial filter code */
var PostClassification = function (image) {
  this.init = function (image) {
    this.image = image;// associa o valor de image ao atributo image de this 
  };

  var majorityFilter = function (image, params) {
    params = ee.Dictionary(params);
    var maxSize = ee.Number(params.get('maxSize')); 
    var classValue = ee.Number(params.get('classValue'));
    var classMask = image.eq(classValue);
    var labeled = classMask.mask(classMask).connectedPixelCount(maxSize, true);
    var region = labeled.lt(maxSize); //<5 [1-4]

    // Squared kernel with size shift 1
    // [[p(x-1,y+1), p(x,y+1), p(x+1,y+1)]
    // [ p(x-1,  y), p( x,y ), p(x+1,  y)]
    // [ p(x-1,y-1), p(x,y-1), p(x+1,y-1)]
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



var versionFT = 3;
var versionSF = 6;
var firstYear = 1985;
var lastYear  = 2024;
var classID   = 31;


var imgColFT     = ee.ImageCollection('projects/'+userEEProject+'/assets/LANDSAT/AQUACULTURE/unet_ft').filter(ee.Filter.eq('version',versionFT));
var filterParams = [{classValue: classID, maxSize: 10}];

for (var year = firstYear; year<lastYear; year ++){
  var curr_segmentation = imgColFT.filter(ee.Filter.eq('year',year)).first().eq(classID).remap([0,1],[0,classID]).rename('classification');
  
  var pc           = new PostClassification(curr_segmentation);
  var finalProduct = pc.spatialFilter(filterParams);
  finalProduct     = finalProduct.eq(classID).remap([0,1],[0,classID]).rename('classification');

  Map.addLayer(finalProduct,{palette:['#000000','#ff003c'], max:classID}, 'Final class '+year,false);
  Map.addLayer(finalProduct.selfMask(),{palette:'#ff003c'}, 'Final class selfmask '+year,false);

  Export.image.toAsset({
    image:finalProduct.select('classification').toByte().set({'classification':4,'class':classID,'year':year,'version':versionSF,'region':'BR', 'filter':2}).toByte(),
    description:'Mapbiomas10_Aqua_v'+versionSF+'_'+ year+'-fs',
    assetId:'projects/'+userEEProject+'/assets/LANDSAT/AQUACULTURE/unet_fs/'+year+'-'+versionSF+'-fs',
    scale:30,
    maxPixels:1e13,
    region: geometry
  });
}