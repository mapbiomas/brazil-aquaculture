<p align="right">
  <img src="./misc/Solved_ vetor 1.png" width="200">
</p>

# Aquaculture Mapping

# About
This repository provides the steps to detect aquaculture areas using Sentinel-2 mosaics.

The detection process focuses on identifying aquaculture areas using Sentinel-2 mosaics. The process involves generating annual cloud-free mosaics using Google Earth Engine (GEE) and applying a [U-Net](https://arxiv.org/abs/1505.04597) deep learning model for segmentation.

For more information about the methodology, please consult the [Coastal Zone Algorithm Theoretical Basis Document.]()


## Repository Structure
The repository is subdivided into folders corresponding to **MapBiomas 10-meters Collections**, for example:

- `MapBiomas02/`
- `MapBiomas03/`

Each collection folder contains:
- The specific processing workflow adopted in that collection
- Scripts and notebooks for data preparation, training, classification, and post-processing
- Class-specific subdirectories when applicable

This structure allows methodologies to evolve across collections while preserving reproducibility and historical context.

---

# How to use
## 0. Prepare environment.
One must have a Google Earth Engine Account ([Get Started](https://earthengine.google.com)), be able to create a GEE repository in the code editor and upload the modules in it.

Some sort of GPU capability is also required for the training process.

## 1. Start processing the annual cloud free composities
Sentinel-2 Mosaics:
        Use USGS Sentinel-2 imagery.
        Generate annual cloud-free mosaics from January 1st to December 31st from 2016-2024.
        Apply a reducer to remove clouds and shadows.

* Script: [1-mosaic-generation.js](./1-mosaic-generation.js)

## 2. Sampling Script
Vizualise the training and validation regions, along with the supervised layer available publicly

* Script:  [2-train-test-dataset.js](./2-train-test-dataset.js)

## 3. Execute the Neural Network.
### 3.1. Training
Training Samples:
        Select training samples based on aquaculture and non-aquaculture categories.
        No differentiation between coastal and continental aquaculture is made during the segmentation.

### 3.2. Prediction
Every prediction is a binary set of pixel values. 0 - "non-aquaculture", 1 - "aquaculture"

Semantic Segmentation

Model:
Use a U-Net neural network to perform semantic segmentation on local servers.

| PARAMETERS   |   VALUES|
|:------------:|:-------:|
Neural network | U-Net |
Tile-Size      | 512 x 512 px |
Samples        | 61370(Train), 14412 (Validation)|
Attributes     | green, red, nir, swir1, NDVI, MNDWI|
Output         | 2 (aquaculture and Not-aquaculture)|

##### Table 2 - CNN attributes and segmentation parameters. In total, six (6) distinct attributes were used.

* Script: [3-Jupyter Notebook](./3-aqua_continente_512.ipynb)

# Filter Chain
## 4. Gap-fill & Temporal filter
Gap-fill: Replace no-data values using the nearest available valid class.
Temporal Filter: Apply a 3-year moving window to correct temporal inconsistencies.

* Script:  [4-gap-fill-temporal-filter.js](./4-gap-fill-temporal-filter.js)

|RULE| INPUT (YEAR) | OUTPUT|
|:--:|:------------:|:-----:|
| - | T1 / T2 / T3 | T1 / T2 / T3 |
| GR| Aqua / N-Aqua / Aqua | Aqua / Aqua / Aqua |
| GR| N-Aqua / Aqua / N-Aqua | N-Aqua / N-Aqua / N-Aqua

## 5. Spatial filter
Spatial Filter: Use GEE's connectedPixelCount to remove isolated pixels, ensuring a minimum mapping unit of ~10px.

* Script:  [5-spatial-filter.js](./5-spatial-filter.js)

# References
### REFERENCE DATA

|CLASS | REFERENCES|
|:----:|:---------:|
|AQUACULTURE / SALT-CULTURE|MapBiomas 10-Meters Collection 2, Atlas Dos Remanescentes Florestais da Mata Atlântica (SOS Mata Atlântica, 2020), Barbier and Cox, 2003; Guimarães et al., 2010; Prates, Gonçalves and Rosa, 2010, Queiroz et al., 2013; Tenório et al., 2015; Thomas et al., 2017, Diniz et al., 2021, São José et al., 2022, plus visual inspection.


--- 

### REFERENCE LITERATURE
SÃO JOSÉ, F. F. DE et al. Mapeamento de viveiros escavados para aquicultura no Brasil por sensoriamento remoto. Embrapa Territorial. Documentos, 144, 2022.

GUIMARÃES, A. S. et al. Impact of aquaculture on mangrove areas in the northern Pernambuco Coast (Brazil) using remote sensing and geographic information system. Aquaculture Research, v. 41, n. 6, p. 828–838, 13 maio 2010. 

QUEIROZ, L. et al. Shrimp aquaculture in the federal state of Ceará, 1970–2012: Trends after mangrove forest privatization in Brazil. [s.l: s.n.]. v. 73

TENÓRIO, G. S. et al. Mangrove shrimp farm mapping and productivity on the Brazilian Amazon coast: Environmental and economic reasons for coastal conservation. Ocean & Coastal Management, v. 104, p. 65–77, 2015. 

USGS. LANDSAT COLLECTION 1 LEVEL 1 PRODUCT DEFINITION. [s.l.] Earth Resources Observation and Science (EROS) Center, 2017. 

XU, H. Modification of normalised difference water index (NDWI) to enhance open water features in remotely sensed imagery. International Journal of Remote Sensing, v. 27, n. 14, p. 3025–3033, 20 jul. 2006. 
 
