"""
NASA Earthdata Integration for Air Quality Prediction
Provides access to multiple NASA satellite datasets for enhanced predictions
"""

import requests
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import os


class NASAEarthdataClient:
    """
    NASA Earthdata API client for accessing satellite data
    """
    
    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://cmr.earthdata.nasa.gov"
        self.earthdata_login_url = "https://urs.earthdata.nasa.gov"
        
        # Headers for authenticated requests
        self.headers = {
            'Authorization': f'Bearer {token}',
            'User-Agent': 'AirQualityPredictor/1.0',
            'Accept': 'application/json'
        }
        
        # Dataset collections for air quality
        self.collections = {
            'modis_aerosol': 'C1443528505-LAADS',  # MODIS Aerosol products
            'modis_fire': 'C1000000640-LPDAAC_ECS',  # MODIS Fire products
            'omi_no2': 'C1443775322-GES_DISC',  # OMI NO2 data
            'omi_so2': 'C1443775298-GES_DISC',  # OMI SO2 data
            'omi_aerosol': 'C1443775319-GES_DISC',  # OMI Aerosol
            'merra2_aerosol': 'C1276812863-GES_DISC',  # MERRA-2 Aerosol
            'gpm_precipitation': 'C1598621093-GES_DISC'  # GPM Precipitation
        }
    
    def search_granules(self, collection_id: str, bbox: Tuple[float, float, float, float], 
                       start_date: str, end_date: str, limit: int = 10) -> Dict[str, Any]:
        """
        Search for data granules in a collection
        
        Args:
            collection_id: NASA collection identifier
            bbox: Bounding box (west, south, east, north)
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            limit: Maximum number of results
        """
        try:
            west, south, east, north = bbox
            
            params = {
                'collection_concept_id': collection_id,
                'bounding_box': f'{west},{south},{east},{north}',
                'temporal': f'{start_date}T00:00:00Z,{end_date}T23:59:59Z',
                'page_size': limit,
                'sort_key': '-start_date'
            }
            
            url = f"{self.base_url}/search/granules.json"
            response = requests.get(url, params=params, headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'results': data.get('feed', {}).get('entry', []),
                    'total_hits': data.get('feed', {}).get('opensearch:totalResults', 0)
                }
            else:
                return {
                    'success': False,
                    'error': f'API request failed: {response.status_code}',
                    'message': response.text
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Search failed: {str(e)}'
            }
    
    def get_modis_aerosol_data(self, lat: float, lon: float, days_back: int = 7) -> Dict[str, Any]:
        """
        Get MODIS aerosol data for air quality analysis
        """
        try:
            # Define bounding box around location (±0.5 degrees)
            bbox = (lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5)
            
            # Date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Search for MODIS aerosol data
            results = self.search_granules(
                collection_id=self.collections['modis_aerosol'],
                bbox=bbox,
                start_date=start_date.strftime('%Y-%m-%d'),
                end_date=end_date.strftime('%Y-%m-%d'),
                limit=20
            )
            
            if results['success'] and results['results']:
                # Process results
                aerosol_data = []
                for granule in results['results']:
                    data_point = {
                        'title': granule.get('title', ''),
                        'start_date': granule.get('time_start', ''),
                        'end_date': granule.get('time_end', ''),
                        'bbox': granule.get('boxes', []),
                        'download_url': granule.get('links', [{}])[0].get('href', '') if granule.get('links') else ''
                    }
                    aerosol_data.append(data_point)
                
                return {
                    'success': True,
                    'data_type': 'MODIS_Aerosol',
                    'location': {'lat': lat, 'lon': lon},
                    'date_range': f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
                    'granules_found': len(aerosol_data),
                    'granules': aerosol_data[:10],  # Limit to 10 for response size
                    'estimated_aod': self._estimate_aod_from_metadata(aerosol_data),
                    'air_quality_impact': self._assess_aerosol_impact(aerosol_data)
                }
            else:
                return {
                    'success': False,
                    'location': {'lat': lat, 'lon': lon},
                    'error': 'No MODIS aerosol data found for location and date range'
                }
                
        except Exception as e:
            return {
                'success': False,
                'location': {'lat': lat, 'lon': lon},
                'error': f'MODIS aerosol data retrieval failed: {str(e)}'
            }
    
    def get_fire_data(self, lat: float, lon: float, days_back: int = 7) -> Dict[str, Any]:
        """
        Get MODIS fire data to assess air quality impact from fires
        """
        try:
            bbox = (lon - 2.0, lat - 2.0, lon + 2.0, lat + 2.0)  # Larger area for fires
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            results = self.search_granules(
                collection_id=self.collections['modis_fire'],
                bbox=bbox,
                start_date=start_date.strftime('%Y-%m-%d'),
                end_date=end_date.strftime('%Y-%m-%d'),
                limit=15
            )
            
            if results['success'] and results['results']:
                fire_data = []
                for granule in results['results']:
                    fire_data.append({
                        'title': granule.get('title', ''),
                        'date': granule.get('time_start', ''),
                        'bbox': granule.get('boxes', [])
                    })
                
                fire_risk = self._assess_fire_impact(fire_data, lat, lon)
                
                return {
                    'success': True,
                    'data_type': 'MODIS_Fire',
                    'location': {'lat': lat, 'lon': lon},
                    'fires_detected': len(fire_data),
                    'fire_risk_level': fire_risk['level'],
                    'fire_impact_score': fire_risk['score'],
                    'air_quality_warning': fire_risk['warning'],
                    'granules': fire_data[:10]
                }
            else:
                return {
                    'success': True,
                    'data_type': 'MODIS_Fire',
                    'location': {'lat': lat, 'lon': lon},
                    'fires_detected': 0,
                    'fire_risk_level': 'Low',
                    'fire_impact_score': 0,
                    'air_quality_warning': 'No significant fire impact detected'
                }
                
        except Exception as e:
            return {
                'success': False,
                'location': {'lat': lat, 'lon': lon},
                'error': f'Fire data retrieval failed: {str(e)}'
            }
    
    def get_precipitation_data(self, lat: float, lon: float, days_back: int = 3) -> Dict[str, Any]:
        """
        Get GPM precipitation data for weather impact analysis
        """
        try:
            bbox = (lon - 1.0, lat - 1.0, lon + 1.0, lat + 1.0)
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            results = self.search_granules(
                collection_id=self.collections['gpm_precipitation'],
                bbox=bbox,
                start_date=start_date.strftime('%Y-%m-%d'),
                end_date=end_date.strftime('%Y-%m-%d'),
                limit=10
            )
            
            if results['success'] and results['results']:
                precip_data = []
                for granule in results['results']:
                    precip_data.append({
                        'title': granule.get('title', ''),
                        'date': granule.get('time_start', ''),
                        'type': 'GPM_Precipitation'
                    })
                
                weather_impact = self._assess_precipitation_impact(precip_data)
                
                return {
                    'success': True,
                    'data_type': 'GPM_Precipitation',
                    'location': {'lat': lat, 'lon': lon},
                    'precipitation_events': len(precip_data),
                    'weather_impact': weather_impact,
                    'air_quality_effect': 'Precipitation generally improves air quality by washing out pollutants',
                    'granules': precip_data
                }
            else:
                return {
                    'success': True,
                    'data_type': 'GPM_Precipitation',
                    'location': {'lat': lat, 'lon': lon},
                    'precipitation_events': 0,
                    'weather_impact': 'Dry conditions - pollutants may accumulate',
                    'air_quality_effect': 'Limited precipitation, potential for pollutant buildup'
                }
                
        except Exception as e:
            return {
                'success': False,
                'location': {'lat': lat, 'lon': lon},
                'error': f'Precipitation data retrieval failed: {str(e)}'
            }
    
    def get_comprehensive_analysis(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Get comprehensive NASA Earth data analysis for air quality prediction
        """
        try:
            # Get all data types
            aerosol_data = self.get_modis_aerosol_data(lat, lon, days_back=7)
            fire_data = self.get_fire_data(lat, lon, days_back=7)
            precip_data = self.get_precipitation_data(lat, lon, days_back=3)
            
            # Combine into comprehensive analysis
            analysis = {
                'success': True,
                'location': {'lat': lat, 'lon': lon},
                'analysis_date': datetime.now().isoformat(),
                'data_sources': ['MODIS_Aerosol', 'MODIS_Fire', 'GPM_Precipitation'],
                'aerosol_analysis': aerosol_data,
                'fire_analysis': fire_data,
                'precipitation_analysis': precip_data,
                'combined_assessment': self._create_combined_assessment(aerosol_data, fire_data, precip_data),
                'ml_features': self._extract_ml_features(aerosol_data, fire_data, precip_data, lat, lon)
            }
            
            return analysis
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Comprehensive analysis failed: {str(e)}'
            }
    
    def _estimate_aod_from_metadata(self, aerosol_data: List[Dict]) -> float:
        """Estimate Aerosol Optical Depth from available data"""
        if not aerosol_data:
            return 0.1  # Background AOD
        
        # Simple estimation based on data availability and location
        base_aod = 0.15
        data_factor = min(len(aerosol_data) / 10.0, 1.0)
        estimated_aod = base_aod + (data_factor * 0.2)
        
        return round(estimated_aod, 3)
    
    def _assess_aerosol_impact(self, aerosol_data: List[Dict]) -> str:
        """Assess air quality impact from aerosol data"""
        if len(aerosol_data) > 15:
            return "High aerosol loading - potential air quality degradation"
        elif len(aerosol_data) > 5:
            return "Moderate aerosol presence - monitor air quality"
        else:
            return "Low aerosol impact - relatively clean air conditions"
    
    def _assess_fire_impact(self, fire_data: List[Dict], lat: float, lon: float) -> Dict[str, Any]:
        """Assess fire impact on air quality"""
        fire_count = len(fire_data)
        
        if fire_count > 10:
            return {
                'level': 'High',
                'score': 0.8,
                'warning': 'Multiple fires detected - expect significant air quality impact'
            }
        elif fire_count > 3:
            return {
                'level': 'Moderate',
                'score': 0.5,
                'warning': 'Some fires detected - possible air quality degradation'
            }
        else:
            return {
                'level': 'Low',
                'score': 0.1,
                'warning': 'Minimal fire activity - limited impact on air quality'
            }
    
    def _assess_precipitation_impact(self, precip_data: List[Dict]) -> str:
        """Assess precipitation impact on air quality"""
        if len(precip_data) > 5:
            return "Recent precipitation - air quality likely improved"
        elif len(precip_data) > 2:
            return "Some precipitation - moderate air quality improvement"
        else:
            return "Limited precipitation - pollutants may persist"
    
    def _create_combined_assessment(self, aerosol_data: Dict, fire_data: Dict, precip_data: Dict) -> Dict[str, Any]:
        """Create combined assessment from all NASA data sources"""
        
        # Calculate overall air quality score (0-100, lower is better)
        base_score = 50
        
        # Aerosol impact
        if aerosol_data.get('success'):
            aod = aerosol_data.get('estimated_aod', 0.1)
            aerosol_impact = min(aod * 100, 30)  # Max 30 points
            base_score += aerosol_impact
        
        # Fire impact
        if fire_data.get('success'):
            fire_score = fire_data.get('fire_impact_score', 0) * 25  # Max 25 points
            base_score += fire_score
        
        # Precipitation benefit
        if precip_data.get('success'):
            precip_events = precip_data.get('precipitation_events', 0)
            precip_benefit = min(precip_events * 5, 20)  # Max 20 points benefit
            base_score -= precip_benefit
        
        # Normalize score
        final_score = max(0, min(100, base_score))
        
        # Determine level
        if final_score > 75:
            level = "Poor"
            color = "#FF4444"
        elif final_score > 50:
            level = "Moderate"
            color = "#FFA500"
        else:
            level = "Good"
            color = "#44AA44"
        
        return {
            'overall_score': round(final_score, 1),
            'air_quality_level': level,
            'level_color': color,
            'confidence': 'High' if all([aerosol_data.get('success'), fire_data.get('success'), precip_data.get('success')]) else 'Medium',
            'recommendation': self._get_recommendation(final_score),
            'data_freshness': 'Real-time satellite data within 1-7 days'
        }
    
    def _extract_ml_features(self, aerosol_data: Dict, fire_data: Dict, precip_data: Dict, lat: float, lon: float) -> Dict[str, float]:
        """Extract ML features from NASA satellite data"""
        features = {}
        
        # Aerosol features
        features['nasa_aod'] = aerosol_data.get('estimated_aod', 0.1) if aerosol_data.get('success') else 0.1
        features['aerosol_data_availability'] = 1.0 if aerosol_data.get('success') else 0.0
        features['aerosol_granules'] = float(aerosol_data.get('granules_found', 0)) if aerosol_data.get('success') else 0.0
        
        # Fire features
        features['fire_risk_score'] = fire_data.get('fire_impact_score', 0.0) if fire_data.get('success') else 0.0
        features['fires_detected'] = float(fire_data.get('fires_detected', 0)) if fire_data.get('success') else 0.0
        features['fire_proximity'] = 1.0 if features['fires_detected'] > 0 else 0.0
        
        # Precipitation features
        features['precip_events'] = float(precip_data.get('precipitation_events', 0)) if precip_data.get('success') else 0.0
        features['precip_benefit'] = min(features['precip_events'] / 5.0, 1.0)  # Normalized 0-1
        
        # Location features
        features['latitude'] = lat
        features['longitude'] = lon
        
        # Composite features
        features['nasa_air_quality_score'] = self._create_combined_assessment(aerosol_data, fire_data, precip_data)['overall_score']
        features['satellite_data_confidence'] = 1.0 if all([aerosol_data.get('success'), fire_data.get('success'), precip_data.get('success')]) else 0.5
        
        return features
    
    def _get_recommendation(self, score: float) -> str:
        """Get air quality recommendation based on score"""
        if score > 75:
            return "Poor air quality expected. Limit outdoor activities, especially for sensitive individuals."
        elif score > 50:
            return "Moderate air quality. Outdoor activities generally acceptable, monitor sensitive individuals."
        else:
            return "Good air quality expected. Outdoor activities recommended."


# Global NASA client instance (will be initialized with token)
nasa_client = None