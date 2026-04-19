# Data Processing and Visualisation Suite

A Python tool for processing, analysing, and visualising numerical data. Designed to perform comparative analysis between datasets (X-Y data) and provide statistical, frequency-domain, and signal processing insights.

## Project Structure

- `core/`: Core data structures and basic operations.
- `analysis/`: Numerical analysis, signal processing, and statistical tools.
- `plotting/`: Visualisation wrappers for Matplotlib and Plotly.
- `utils/`: Common helper functions.

## Key Features

- **X-Y Data Management**: Validated data structures for consistent processing.
- **Statistical Analysis**: RMS, Skew, Kurtosis, Correlation, Covariance.
- **Signal Processing**: Integration, Differentiation, Smoothing, Outlier Detection.
- **Frequency Analysis**: Power Spectral Density (PSD) and Frequency Response Functions (FRF).
- **Comparative Tools**: Resampling for non-conforming timestamps, cross-correlation, and trend comparison.
- **Visualisation**: Automated generation of time-series, frequency, and correlation plots.

## Installation

```bash
pip install numpy scipy matplotlib plotly
```

## Usage Example

```python
import numpy as np
import analysis.core as ac

# Generate dummy data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Analyze
rms_val = ac.rms(y)
f, psd = ac.get_psd(x, y)
```
