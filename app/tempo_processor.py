"""
TEMPO Satellite Data Processor for NO2 and Air Quality Predictions
Supports NetCDF files from TEMPO satellite instrument
"""

import numpy as np
import pandas as pd
import xarray as xr
import netCDF4 as nc
from datetime import datetime, timedelta
import os
import json
from typing import Dict, List, Tuple, Optional, Any


class TempoDataProcessor:
    """
    Process TEMPO NO2 satellite data for machine learning predictions
    """
    
    def __init__(self):
        self.data = None
        self.processed_data = None
        self.metadata = {}
        
    def read_tempo_file(self, filepath: str) -> Dict[str, Any]:
        """
        Read TEMPO NetCDF file and extract relevant data
        """
        try:
            # Check if file exists
            if not os.path.exists(filepath):
                raise FileNotFoundError(f"TEMPO file not found: {filepath}")
            
            print(f"Reading TEMPO file: {filepath}")
            
            # Open NetCDF file using xarray with groups support
            try:
                # Try opening as a grouped dataset first
                import netCDF4 as nc
                nc_ds = nc.Dataset(filepath, 'r')
                
                # Check if it has groups (TEMPO L2 structure)
                if hasattr(nc_ds, 'groups') and len(nc_ds.groups) > 0:
                    print(f"Found groups: {list(nc_ds.groups.keys())}")
                    
                    # Open each group as xarray dataset
                    self.data = {}
                    for group_name in nc_ds.groups.keys():
                        group_path = f"{filepath}#{group_name}"
                        try:
                            self.data[group_name] = xr.open_dataset(filepath, group=group_name, engine='netcdf4')
                            print(f"Loaded group '{group_name}' with variables: {list(self.data[group_name].variables.keys())}")
                        except Exception as e:
                            print(f"Warning: Could not load group '{group_name}': {e}")
                    
                    # Also load root level
                    self.data['root'] = xr.open_dataset(filepath, engine='netcdf4')
                    
                    nc_ds.close()
                    
                    # Set main data to product group if available
                    if 'product' in self.data:
                        self.main_data = self.data['product']
                    else:
                        self.main_data = self.data.get('root', list(self.data.values())[0])
                else:
                    # Standard single-group file
                    nc_ds.close()
                    self.data = xr.open_dataset(filepath, engine='netcdf4')
                    self.main_data = self.data
                    
            except Exception as e:
                print(f"Warning: Group loading failed, trying standard approach: {e}")
                # Fallback to standard loading
                self.data = xr.open_dataset(filepath, engine='netcdf4')
                self.main_data = self.data
            
            # Extract metadata from filename
            filename = os.path.basename(filepath)
            self.metadata = self._parse_tempo_filename(filename)
            
            # Get file information
            if isinstance(self.data, dict):
                all_variables = []
                all_dimensions = {}
                for group_name, group_data in self.data.items():
                    group_vars = [f"{group_name}/{var}" for var in group_data.variables.keys()]
                    all_variables.extend(group_vars)
                    all_dimensions.update({f"{group_name}/{dim}": size for dim, size in group_data.dims.items()})
                
                file_info = {
                    'filename': filename,
                    'file_size': os.path.getsize(filepath),
                    'variables': all_variables,
                    'dimensions': all_dimensions,
                    'groups': list(self.data.keys()),
                    'metadata': self.metadata
                }
            else:
                file_info = {
                    'filename': filename,
                    'file_size': os.path.getsize(filepath),
                    'variables': list(self.data.variables.keys()),
                    'dimensions': dict(self.data.dims),
                    'metadata': self.metadata
                }
            
            print(f"Successfully loaded TEMPO data with variables: {file_info['variables'][:10]}...")  # Show first 10
            return file_info
            
        except Exception as e:
            print(f"Error reading TEMPO file: {e}")
            raise
    
    def _parse_tempo_filename(self, filename: str) -> Dict[str, Any]:
        """
        Parse TEMPO filename to extract metadata
        Example: TEMPO_NO2_L2_NRT_V02_20251003T224442Z_S013G03.nc
        """
        parts = filename.replace('.nc', '').split('_')
        
        metadata = {
            'instrument': 'TEMPO',
            'product': 'NO2',
            'level': 'L2',
            'version': 'V02',
            'processing': 'NRT'  # Near Real Time
        }
        
        # Extract date and time
        for part in parts:
            if 'T' in part and 'Z' in part:
                try:
                    date_str = part.replace('Z', '')
                    metadata['observation_time'] = datetime.strptime(date_str, '%Y%m%dT%H%M%S')
                    metadata['date'] = metadata['observation_time'].date()
                except:
                    pass
            elif part.startswith('S') and 'G' in part:
                # Spatial/grid information
                metadata['spatial_id'] = part
        
        return metadata
    
    def extract_no2_data(self, lat_range: Tuple[float, float] = None, 
                        lon_range: Tuple[float, float] = None) -> pd.DataFrame:
        """
        Extract NO2 data and convert to DataFrame for ML processing
        """
        if self.data is None:
            raise ValueError("No TEMPO data loaded. Call read_tempo_file() first.")
        
        try:
            # Handle grouped vs single dataset
            if isinstance(self.data, dict):
                # TEMPO L2 grouped structure
                product_data = self.data.get('product')
                geolocation_data = self.data.get('geolocation')
                
                if not product_data or not geolocation_data:
                    raise ValueError("Required TEMPO groups 'product' and 'geolocation' not found")
                
                # Get NO2 column data from product group
                no2_var_names = ['vertical_column_troposphere', 'no2_column', 'column_amount']
                no2_var = None
                
                for var_name in no2_var_names:
                    if var_name in product_data.variables:
                        no2_var = var_name
                        break
                
                if not no2_var:
                    print("Available product variables:", list(product_data.variables.keys()))
                    raise ValueError("No NO2 data variable found in TEMPO product group")
                
                print(f"Using NO2 variable: {no2_var}")
                
                # Get coordinates from geolocation group
                if 'latitude' not in geolocation_data.variables or 'longitude' not in geolocation_data.variables:
                    print("Available geolocation variables:", list(geolocation_data.variables.keys()))
                    raise ValueError("Latitude/Longitude coordinates not found in geolocation group")
                
                # Extract data
                no2_data = product_data[no2_var]
                lat_data = geolocation_data['latitude']
                lon_data = geolocation_data['longitude']
                
                # Get time if available
                time_data = geolocation_data.get('time', None)
                
            else:
                # Single dataset structure
                no2_var_names = [var for var in self.data.variables if 'no2' in var.lower() or 'nitrogen' in var.lower()]
                
                if not no2_var_names:
                    possible_vars = ['vertical_column_troposphere', 'column_amount', 'no2_column', 'no2_vertical_column']
                    no2_var_names = [var for var in possible_vars if var in self.data.variables]
                
                if not no2_var_names:
                    print("Available variables:", list(self.data.variables.keys()))
                    raise ValueError("No NO2 data variable found in TEMPO file")
                
                no2_var = no2_var_names[0]
                print(f"Using NO2 variable: {no2_var}")
                
                # Get coordinates
                lat_var = 'latitude' if 'latitude' in self.data.variables else 'lat'
                lon_var = 'longitude' if 'longitude' in self.data.variables else 'lon'
                
                if lat_var not in self.data.variables or lon_var not in self.data.variables:
                    print("Available coordinate variables:", [v for v in self.data.variables if any(coord in v.lower() for coord in ['lat', 'lon'])])
                    raise ValueError("Latitude/Longitude coordinates not found")
                
                # Extract data
                no2_data = self.data[no2_var]
                lat_data = self.data[lat_var]
                lon_data = self.data[lon_var]
                time_data = None
            
            # Convert to numpy arrays
            no2_values = no2_data.values
            lat_values = lat_data.values
            lon_values = lon_data.values
            
            print(f"Data shapes - NO2: {no2_values.shape}, Lat: {lat_values.shape}, Lon: {lon_values.shape}")
            
            # Handle multi-dimensional data - flatten all arrays consistently
            if len(no2_values.shape) > 1:
                no2_flat = no2_values.flatten()
                lat_flat = lat_values.flatten()
                lon_flat = lon_values.flatten()
            else:
                no2_flat = no2_values
                lat_flat = lat_values
                lon_flat = lon_values
            
            # Ensure all arrays have the same length
            min_length = min(len(no2_flat), len(lat_flat), len(lon_flat))
            no2_flat = no2_flat[:min_length]
            lat_flat = lat_flat[:min_length]
            lon_flat = lon_flat[:min_length]
            
            # Filter by geographic bounds if provided
            if lat_range is not None and lon_range is not None:
                lat_mask = (lat_flat >= lat_range[0]) & (lat_flat <= lat_range[1])
                lon_mask = (lon_flat >= lon_range[0]) & (lon_flat <= lon_range[1])
                combined_mask = lat_mask & lon_mask
                
                no2_filtered = no2_flat[combined_mask]
                lat_filtered = lat_flat[combined_mask]
                lon_filtered = lon_flat[combined_mask]
            else:
                no2_filtered = no2_flat
                lat_filtered = lat_flat
                lon_filtered = lon_flat
            
            # Remove invalid values (NaN, fill values, negative values)
            valid_mask = (~np.isnan(no2_filtered) & 
                         ~np.isnan(lat_filtered) & 
                         ~np.isnan(lon_filtered) & 
                         (no2_filtered > -9999) & 
                         (no2_filtered < 1e20) &
                         (no2_filtered > 0) &  # NO2 should be positive
                         (lat_filtered >= -90) & (lat_filtered <= 90) &
                         (lon_filtered >= -180) & (lon_filtered <= 180))
            
            if valid_mask.sum() == 0:
                raise ValueError("No valid NO2 observations found after filtering")
            
            # Create DataFrame
            df = pd.DataFrame({
                'latitude': lat_filtered[valid_mask],
                'longitude': lon_filtered[valid_mask],
                'no2_column': no2_filtered[valid_mask],
                'observation_time': self.metadata.get('observation_time', datetime.now())
            })
            
            # Add additional features
            df['hour'] = df['observation_time'].dt.hour if hasattr(df['observation_time'], 'dt') else self.metadata.get('observation_time', datetime.now()).hour
            df['day_of_week'] = df['observation_time'].dt.dayofweek if hasattr(df['observation_time'], 'dt') else self.metadata.get('observation_time', datetime.now()).weekday()
            
            # Convert NO2 to AQI estimate (simplified conversion)
            df['estimated_aqi'] = self._no2_to_aqi(df['no2_column'])
            
            print(f"Extracted {len(df)} valid NO2 observations")
            print(f"NO2 range: {df['no2_column'].min():.2e} to {df['no2_column'].max():.2e} molecules/cm²")
            print(f"Geographic coverage: Lat {df['latitude'].min():.2f}-{df['latitude'].max():.2f}, Lon {df['longitude'].min():.2f}-{df['longitude'].max():.2f}")
            
            self.processed_data = df
            return df
            
        except Exception as e:
            print(f"Error extracting NO2 data: {e}")
            raise
    
    def _no2_to_aqi(self, no2_column: np.ndarray) -> np.ndarray:
        """
        Convert NO2 column density to estimated AQI
        Note: This is a simplified conversion for demonstration
        """
        # TEMPO NO2 is typically in molecules/cm²
        # Convert to AQI using rough approximation
        
        # Normalize NO2 values (typical range: 1e14 to 1e16 molecules/cm²)
        no2_normalized = np.log10(no2_column + 1e14) - 14  # Log scale 0-2
        
        # Map to AQI scale (0-500)
        aqi_estimated = np.clip(no2_normalized * 100, 0, 300)  # Scale to 0-300 AQI
        
        return aqi_estimated
    
    def aggregate_to_grid(self, grid_size: float = 0.1) -> pd.DataFrame:
        """
        Aggregate data to regular grid for ML processing
        """
        if self.processed_data is None:
            raise ValueError("No processed data available. Call extract_no2_data() first.")
        
        df = self.processed_data.copy()
        
        # Create grid coordinates
        df['lat_grid'] = np.round(df['latitude'] / grid_size) * grid_size
        df['lon_grid'] = np.round(df['longitude'] / grid_size) * grid_size
        
        # Aggregate by grid cell
        aggregated = df.groupby(['lat_grid', 'lon_grid']).agg({
            'no2_column': ['mean', 'std', 'count'],
            'estimated_aqi': ['mean', 'std'],
            'hour': 'first',
            'day_of_week': 'first'
        }).reset_index()
        
        # Flatten column names
        aggregated.columns = ['latitude', 'longitude', 'no2_mean', 'no2_std', 'no2_count', 
                             'aqi_mean', 'aqi_std', 'hour', 'day_of_week']
        
        # Add metadata
        aggregated['observation_time'] = self.metadata.get('observation_time', datetime.now())
        aggregated['data_source'] = 'TEMPO'
        
        return aggregated
    
    def create_ml_features(self, target_location: Tuple[float, float] = None) -> Dict[str, Any]:
        """
        Create features for ML prediction from TEMPO data
        """
        if self.processed_data is None:
            raise ValueError("No processed data available. Call extract_no2_data() first.")
        
        features = {}
        
        # Overall statistics
        features['no2_mean'] = float(self.processed_data['no2_column'].mean())
        features['no2_median'] = float(self.processed_data['no2_column'].median())
        features['no2_std'] = float(self.processed_data['no2_column'].std())
        features['no2_max'] = float(self.processed_data['no2_column'].max())
        features['no2_min'] = float(self.processed_data['no2_column'].min())
        
        # Time features
        obs_time = self.metadata.get('observation_time', datetime.now())
        features['observation_time'] = obs_time.isoformat() if hasattr(obs_time, 'isoformat') else str(obs_time)
        features['hour'] = obs_time.hour
        features['day_of_week'] = obs_time.weekday()
        features['month'] = obs_time.month
        features['season'] = (obs_time.month % 12) // 3  # 0=Winter, 1=Spring, 2=Summer, 3=Fall
        
        # Spatial features
        features['lat_center'] = float(self.processed_data['latitude'].mean())
        features['lon_center'] = float(self.processed_data['longitude'].mean())
        features['spatial_coverage'] = len(self.processed_data)
        
        # Target location specific (if provided)
        if target_location is not None:
            target_lat, target_lon = target_location
            
            # Find nearest observations
            distances = np.sqrt((self.processed_data['latitude'] - target_lat)**2 + 
                              (self.processed_data['longitude'] - target_lon)**2)
            
            nearest_idx = distances.idxmin()
            nearest_data = self.processed_data.iloc[nearest_idx]
            
            features['target_no2'] = float(nearest_data['no2_column'])
            features['target_aqi_estimate'] = float(nearest_data['estimated_aqi'])
            features['distance_to_nearest'] = float(distances.min())
            
            # Local statistics (within 0.5 degrees)
            local_mask = distances <= 0.5
            if local_mask.sum() > 0:
                local_data = self.processed_data[local_mask]
                features['local_no2_mean'] = float(local_data['no2_column'].mean())
                features['local_no2_std'] = float(local_data['no2_column'].std())
                features['local_observations'] = len(local_data)
            else:
                features['local_no2_mean'] = features['no2_mean']
                features['local_no2_std'] = features['no2_std']
                features['local_observations'] = 1
        
        # Data quality indicators
        features['data_completeness'] = float(len(self.processed_data) / max(1, len(self.processed_data)))
        features['no2_variability'] = float(features['no2_std'] / (features['no2_mean'] + 1e-6))
        
        return features
    
    def get_file_summary(self) -> Dict[str, Any]:
        """
        Get summary information about the loaded TEMPO file
        """
        if self.data is None:
            return {"error": "No TEMPO data loaded"}
        
        summary = {
            "metadata": self.metadata,
            "coordinate_ranges": {},
            "data_summary": {}
        }
        
        if isinstance(self.data, dict):
            # Grouped structure
            summary["groups"] = list(self.data.keys())
            summary["variables"] = {}
            summary["dimensions"] = {}
            
            for group_name, group_data in self.data.items():
                summary["variables"][group_name] = list(group_data.variables.keys())
                summary["dimensions"][group_name] = dict(group_data.dims)
                
                # Get coordinate ranges for this group
                for coord in ['latitude', 'longitude', 'lat', 'lon']:
                    if coord in group_data.variables:
                        values = group_data[coord].values
                        summary["coordinate_ranges"][f"{group_name}/{coord}"] = {
                            "min": float(np.nanmin(values)),
                            "max": float(np.nanmax(values)),
                            "shape": list(values.shape)
                        }
                
                # Get data variable summary for this group
                for var in group_data.variables:
                    if var not in ['latitude', 'longitude', 'lat', 'lon', 'time']:
                        try:
                            values = group_data[var].values
                            summary["data_summary"][f"{group_name}/{var}"] = {
                                "shape": list(values.shape),
                                "min": float(np.nanmin(values)),
                                "max": float(np.nanmax(values)),
                                "mean": float(np.nanmean(values)),
                                "valid_points": int(np.sum(~np.isnan(values)))
                            }
                        except:
                            summary["data_summary"][f"{group_name}/{var}"] = {"error": "Could not process variable"}
        else:
            # Single dataset structure
            summary["variables"] = list(self.data.variables.keys())
            summary["dimensions"] = dict(self.data.dims)
            
            # Get coordinate ranges
            for coord in ['latitude', 'longitude', 'lat', 'lon']:
                if coord in self.data.variables:
                    values = self.data[coord].values
                    summary["coordinate_ranges"][coord] = {
                        "min": float(np.nanmin(values)),
                        "max": float(np.nanmax(values)),
                        "shape": list(values.shape)
                    }
            
            # Get data variable summary
            for var in self.data.variables:
                if var not in ['latitude', 'longitude', 'lat', 'lon']:
                    try:
                        values = self.data[var].values
                        summary["data_summary"][var] = {
                            "shape": list(values.shape),
                            "min": float(np.nanmin(values)),
                            "max": float(np.nanmax(values)),
                            "mean": float(np.nanmean(values)),
                            "valid_points": int(np.sum(~np.isnan(values)))
                        }
                    except:
                        summary["data_summary"][var] = {"error": "Could not process variable"}
        
        return summary


# Global instance
tempo_processor = TempoDataProcessor()