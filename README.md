<p align="right">
  <img src="misc/Solved_ vetor 1.png" width="200">
</p>

# Aquaculture Mapping

## Overview
This repository contains the workflows and methodologies used to detect **Aquacultures and Saltcultures in Brazil** within the MapBiomas Brazil project.

The mapping relies on a multi-sensor approach, utilizing both Landsat Top-of-Atmosphere (TOA) imagery (`30m resolution`) and Sentinel-2 imagery (`10m resolution`). It combines machine learning and deep learning approaches (semantic segmentation) to generate annual maps for multiple coastal and continental environments.

To ensure consistency and scalability across different MapBiomas mapping initiatives, the repository is organized by satellite sensor and MapBiomas Collection versions.

---

## Repository Structure & Collections

The codebase is divided into two main branches based on the sensor resolution and the specific MapBiomas collection being processed:

* **`Landsat_30m/`**
  * **`Mapbiomas10/`**: Contains the processing pipeline for **MapBiomas Collection 10**. This collection utilizes 30-meter spatial resolution data from Landsat sensors to create long-term historical series of aquaculture and saltpan dynamics. 
* **`Sentinel2_10m/`**
  * **`Mapbiomas03/`**: Contains the processing pipeline for **MapBiomas Collection 3** (focused on higher-resolution/water mappings). This collection leverages the 10-meter spatial resolution of Sentinel-2 to capture finer details of aquaculture tanks and coastal structures.

---

## General Workflow
Across both collections, the aquaculture mapping follows a common, numbered pipeline. While implementation details (like spatial parameters or index calculations) may vary between sensors, the core sequence remains the same:

1. **Mosaic Generation (`1-mosaic-generation.js`)**: Extraction and cloud-masking of annual satellite composites (Landsat or Sentinel-2).
2. **Dataset Preparation (`2-train-test-dataset.js`)**: Generation and formatting of training and testing patches for deep learning models.
3. **Deep Learning Classification (`3-*.ipynb`)**: Semantic segmentation using deep learning models implemented in Jupyter Notebooks to predict aquaculture areas.
4. **Gap Filling & Temporal Filter (`4-gap-fill-temporal-filter.js`)**: Post-processing to ensure temporal consistency across the years.
5. **Spatial Filter (`5-spatial-filter.js`)**: Morphological operations to remove isolated pixels and refine borders.
6. **Frequency Filter (`6-frequency-filter.js` - *Landsat only*)**: Final stabilization based on the occurrence frequency of the class over the time series.

*Annual results are subsequently reviewed and integrated into the broader MapBiomas land use and land cover maps.*

---

## Methodological Reference
A detailed description of the theoretical background, sensor selection, and methodological decisions is available in the:

[Coastal Zone Algorithm Theoretical Basis Document (ATBD)](https://doi.org/10.58053/MapBiomas/D0UVI6)

---

## Notes
This README provides a **general overview** of the repository's architecture.  
For step-by-step execution guides, hyperparameters, and collection-specific details, please refer to the `README.md` files located inside each specific collection directory (`Landsat_30m/Mapbiomas10/` and `Sentinel2_10m/Mapbiomas03/`).