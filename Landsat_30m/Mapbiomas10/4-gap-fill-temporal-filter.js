  //------------------------------------- Flags -----------------------------------------
  var AQ = 31;
  var NO = 50; 
  var mask = -1; 
  
  var firstYear  = 1985;
  var lastYear   = 2024;

  var userEEProject='USER_PROJECT_ID'
  
  
  //------------------------------- Load data function ----------------------------------
  var loadData = function() {
    var maps = [];
    var i = 0; 
    for(var year = firstYear; year <= lastYear; year++){ 
      var image = ee.Image('projects/'+userEEProject+'/assets/LANDSAT/AQUACULTURE/out_deepLearning/'+year+'_v4_CONTINENTAL_e64').gte(threshold).set('year',year).remap([0,1],[0,AQ]).rename('classification').toByte()
      var imgeMerge = ee.ImageCollection([image]).max();
      maps[i] = imgeMerge;
      var mosaic = ee.Image('projects/'+userEEProject+'/assets/USER_PATH/mosaic_'+year);
      mosaic = mosaic.select(0).unmask(0);
      var nodata = ee.Image(NO).mask(mosaic.select(0).eq(0)).rename('classification').toByte();
      maps[i] =  maps[i].updateMask(maps[i].lte(33)).unmask(0);
      maps[i] = ee.ImageCollection([maps[i],nodata]).mosaic().set({"year":year});
      i = i + 1;
    }
    return maps;
  }
  //--------------------------------- Rules for NO -----------------------------------------
  
  // rule 1
  var tfNOFirstYear = function(im1, im2, im3) {
    im1 = im1.where(im1.eq(NO).and(im2.neq(NO)).and(im2.neq(mask)),im2);
    return im1.where(im1.eq(NO).and(im2.eq(NO)).and(im3.neq(NO)).and(im3.neq(mask)),im3);
  };
  
  // rule 2
  var tfNOCenterYear = function(im1, im2, im3) {
    im2 = im2.where(im2.eq(NO).and(im1.neq(NO)).and(im1.neq(mask)),im1);
    return im2.where(im2.eq(NO).and(im1.eq(NO)).and(im3.neq(NO)).and(im3.neq(mask)),im3);
  };
  
  // rule 3
  var tfNOLastYear = function(im1, im2, im3) {
    im3 = im3.where(im3.eq(NO).and(im2.neq(NO)).and(im2.neq(mask)),im2);
    return im3.where(im3.eq(NO).and(im2.eq(NO)).and(im1.neq(NO)).and(im1.neq(mask)),im1);
  };
  
  //------------------------ General rules - Neighbors match ---------------------------
  
  // rule 4
  var tfFirstYearLastTwoMatch = function(im1, im2, im3) {
    return im1.where(im2.eq(im3).and(im2.neq(mask)),im2);
  };
   
  // rule 5
  var tfCenterYearFirstAndLastMatch = function(im1, im2, im3) {
    return im2.where(im1.eq(im3).and(im1.neq(mask)),im1);
  };
  
  // rule 6
  var tfLastYearFirstTwoMatch = function(im1, im2, im3) {
    return im3.where(im1.eq(im2).and(im1.neq(mask)),im1);
  };
  
  //----------------------- Specific rules - Depend on classes ---------------------------
  
  
  var fillGaps = function(imageList,classValue){
    var limit  = lastYear - firstYear
    print('Limit',limit)
    for(var i = 0; i <= limit; i = i +1){ 
      var maskFiller = ee.Image(NO).mask(imageList[i].eq(NO));
      if(i < (limit)){
        for(var j = i; j < i+limit && j < limit; j = j +1){ 
          maskFiller = maskFiller.where(maskFiller.eq(NO).and(imageList[j].neq(NO)),imageList[j]);
        }
      }else{
        for(var j = i; j < i+limit && j < limit; j = j +1){ 
          maskFiller = maskFiller.where(maskFiller.eq(NO).and(imageList[j].neq(NO)),imageList[j]);
        }
        maskFiller = maskFiller.where(maskFiller.eq(NO).and(imageList[i-1].neq(NO)),imageList[i-1]);
        maskFiller = maskFiller.where(maskFiller.eq(NO).and(imageList[i-2].neq(NO)),imageList[i-2]);
        maskFiller = maskFiller.where(maskFiller.eq(NO).and(imageList[i-3].neq(NO)),imageList[i-3]);
      }
      imageList[i] = imageList[i].where(imageList[i].eq(NO),maskFiller.unmask(NO));
    }
    return imageList;
  }
  
  //------------------------------------- Filters -----------------------------------------
  
  var filterCenterYears = function(maps) {
    // Safe backup copy
    var backup = [];
    for(var i = 0; i < (lastYear-firstYear)+1; i++){
      backup[i] = maps[i];
    }
    print(">> Rule for the center years\n\n");
    for(var control = 1; control <= 3; control++){
      i = control;
      for(var year = firstYear + control; year < lastYear; year++) {
        print("Filtering years: " + (year - 1) + " " + year + " " + (year + 1));
        print("Modifying year at index: " + i + " (" + year + ")\n\n");
        maps[i] = tfNOCenterYear(backup[i-1],backup[i],backup[i+1]);
        maps[i] = tfCenterYearFirstAndLastMatch(backup[i-1],maps[i],backup[i+1]);
        i = i + 3;
        year = year + 2;
      }
      print(control+" control new years\n\n\n\n")
    }
    return maps;
  }
  
  var filterFirtsYears = function(maps) {
    // Safe backup copy
    var backup = [];
    for(var i = 0; i < (lastYear-firstYear)+1; i++){
      backup[i] = maps[i];
    }
    print(">> Rule for the first years\n\n");
    for(var control = 1; control <= 3; control++){
      i = control;
      for(var year = firstYear + control; year < lastYear; year++) {
        print("Filtering years: " + (year - 1) + " " + year + " " + (year + 1));
        print("Modifying year at index: " + (i-1) + " (" + (year-1) + ")\n\n");
        maps[i-1] = tfNOFirstYear(backup[i-1],backup[i],backup[i+1]);
        maps[i-1] = tfFirstYearLastTwoMatch(maps[i-1],backup[i],backup[i+1]);
        i = i + 3;
        year = year + 2;
      }
    }
    return maps;
  }
  
  var filterLastYears = function(maps) {
    // Safe backup copy
    var backup = [];
    for(var i = 0; i < (lastYear-firstYear)+1; i++){
      backup[i] = maps[i];
    }
    print(">> Rule for the last years\n\n");
    for(var control = 1; control <= 3; control++){
      i = control;
      for(var year = firstYear + control; year < lastYear; year++) {
        print("Filtering years: " + (year - 1) + " " + year + " " + (year + 1));
        print("Modifying year at index: " + (i+1) + " (" + (year+1) + ")\n\n");
        maps[i+1] = tfNOLastYear(backup[i-1],backup[i],backup[i+1]);
        maps[i+1] = tfLastYearFirstTwoMatch(backup[i-1],backup[i],maps[i+1]);
        i = i + 3;
        year = year + 2;
      }
    }
    return maps;
  }
  //------------------------------------ Run Filter --------------------------------------
  /// Main CODE
  // Boundary box de todo o Brasil
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

  var maps = loadData();
  var originals = maps;
  maps = fillGaps(maps,AP);
  maps = filterCenterYears(maps);
  maps = filterFirtsYears(maps);
   
  
  // rule 3
  var valueNO = function(im,index, backup) {
    for (var i = index+1; i < (lastYear-firstYear)+1; i++){ //vai
      im = im.where(im.eq(NO).and(backup[i].neq(NO)).and(backup[i].neq(mask)),backup[i]);
    }
    for (var i = index-1; i >= 0; i--){ //volta
      im = im.where(im.eq(NO).and(backup[i].neq(NO)).and(backup[i].neq(mask)),backup[i]);
    }
    return im;
  };
  var searchForValidGap = function(maps) {
    // Safe backup copy
    var backup = [];
    for(var i = 0; i < (lastYear-firstYear)+1; i++){
      backup[i] = maps[i];
    }
    for(var control = 0; control < (lastYear-firstYear)+1; control++){ //vai
      i = control;
      maps[i] = valueNO(backup[i],i, backup);
    }
    return maps;
  };
  maps = searchForValidGap(maps); 
  
  
  for(var i = 0; i < (lastYear-firstYear)+1; i++){
    maps[i] = maps[i].updateMask(maps[i].neq(mask));
  }
  var palettes=require("users/mapbiomas/modules:Palettes.js")
  var mapbiomasColors = palettes.get("classification2")
  for(var i = 0; i < (lastYear-firstYear)+1; i++){
    Map.addLayer(maps[i],{min: 0, max: 33,palette:mapbiomasColors}, "Nmap " + (firstYear+i)+"    a",false);
  }
  
  var originals = loadData();
  for(var i = 0; i < (lastYear-firstYear)+1; i++){
    Map.addLayer(originals[i].updateMask(originals[i].neq(mask)),{min: 0, max: 33,palette:mapbiomasColors}, "Map " + (firstYear+i),false);
  }
   
  


  var classID = AQ;
  var version = 1;
  for(var year = firstYear; year <= lastYear; year++) {
    Export.image.toAsset({
      image: (ee.ImageCollection([(ee.Image(ee.List(maps).filter(ee.Filter.eq("year",year)).get(0)))
      .rename('classification').toByte()])
      .mosaic())
      .set({'unet_version':4,'class':classID,'year':year,'filter':1,'region':'BR','collection':10, 'version':version, 'threshold':threshold}).toByte(),
      description:'ft_1_BR_v'+version+'_'+year,
      assetId: 'projects/'+userEEProject+'/assets/LANDSAT/AQUACULTURE/unet_ft/ft_1_BR_v'+version+'_'+year,
      scale: 30,
      maxPixels:1e13,
      region: ROI
    });
  }