"""
ML Prediction System for Weather and Air Quality Data
Supports multiple algorithms: Linear Regression, Random Forest, SVM
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.svm import SVR
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import joblib
import json
from datetime import datetime, timedelta
import os


class WeatherAQIPredictionModel:
    def __init__(self):
        self.models = {
            'linear_regression': LinearRegression(),
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'svm': SVR(kernel='rbf', C=1.0, gamma='scale')
        }
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.trained_models = {}
        self.model_performance = {}
        self.feature_names = []
        
    def prepare_features(self, data):
        """
        Prepare features from weather and AQI data
        """
        df = pd.DataFrame(data)
        
        # Create time-based features
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df['hour'] = df['timestamp'].dt.hour
            df['day_of_week'] = df['timestamp'].dt.dayofweek
            df['month'] = df['timestamp'].dt.month
            df['season'] = df['month'].apply(self._get_season)
        
        # Weather features
        weather_features = ['temp', 'humidity', 'pressure', 'wind_speed', 'visibility']
        for feature in weather_features:
            if feature not in df.columns:
                df[feature] = np.random.uniform(0, 100)  # Default values if missing
        
        # AQI and pollutant features
        pollutant_features = ['pm2_5', 'pm10', 'o3', 'no2', 'so2', 'co']
        for feature in pollutant_features:
            if feature not in df.columns:
                df[feature] = np.random.uniform(0, 200)  # Default values if missing
        
        # Create lag features (previous values)
        for col in ['temp', 'humidity', 'pm2_5', 'pm10']:
            if col in df.columns:
                df[f'{col}_lag1'] = df[col].shift(1)
                df[f'{col}_lag2'] = df[col].shift(2)
        
        # Create rolling averages
        for col in ['temp', 'pm2_5', 'pm10']:
            if col in df.columns:
                df[f'{col}_rolling_3'] = df[col].rolling(window=3).mean()
                df[f'{col}_rolling_6'] = df[col].rolling(window=6).mean()
        
        # Fill missing values
        df = df.fillna(df.mean())
        
        return df
    
    def _get_season(self, month):
        """Convert month to season"""
        if month in [12, 1, 2]:
            return 0  # Winter
        elif month in [3, 4, 5]:
            return 1  # Spring
        elif month in [6, 7, 8]:
            return 2  # Summer
        else:
            return 3  # Autumn
    
    def generate_synthetic_data(self, num_samples=1000):
        """
        Generate synthetic weather and AQI data for training
        """
        np.random.seed(42)
        
        # Generate base data
        dates = pd.date_range(start='2023-01-01', periods=num_samples, freq='H')
        
        data = []
        for i, date in enumerate(dates):
            # Simulate realistic weather patterns
            hour = date.hour
            month = date.month
            
            # Temperature (with daily and seasonal cycles)
            base_temp = 20 + 15 * np.sin(2 * np.pi * month / 12)  # Seasonal cycle
            daily_temp = base_temp + 10 * np.sin(2 * np.pi * hour / 24)  # Daily cycle
            temp = daily_temp + np.random.normal(0, 3)
            
            # Humidity (inversely related to temperature)
            humidity = max(20, min(100, 80 - 0.5 * (temp - 20) + np.random.normal(0, 10)))
            
            # Pressure
            pressure = 1013 + np.random.normal(0, 20)
            
            # Wind speed
            wind_speed = max(0, np.random.exponential(5))
            
            # Visibility
            visibility = max(1, min(20, 10 + np.random.normal(0, 3)))
            
            # Pollutants (affected by weather and time)
            pm2_5 = max(0, 30 + (35 - temp) * 0.5 + (100 - humidity) * 0.2 + np.random.normal(0, 15))
            pm10 = pm2_5 * 1.5 + np.random.normal(0, 10)
            o3 = max(0, 50 + temp * 0.8 - humidity * 0.3 + np.random.normal(0, 20))
            no2 = max(0, 25 + (hour > 6 and hour < 22) * 15 + np.random.normal(0, 10))
            so2 = max(0, 15 + np.random.normal(0, 8))
            co = max(0, 1 + (hour > 6 and hour < 22) * 0.5 + np.random.normal(0, 0.3))
            
            # AQI calculation (simplified)
            aqi = max(pm2_5 / 12, pm10 / 25, o3 / 80, no2 / 40) * 50
            aqi = min(500, max(0, aqi + np.random.normal(0, 10)))
            
            data.append({
                'timestamp': date,
                'temp': round(temp, 1),
                'humidity': round(humidity, 1),
                'pressure': round(pressure, 1),
                'wind_speed': round(wind_speed, 1),
                'visibility': round(visibility, 1),
                'pm2_5': round(pm2_5, 1),
                'pm10': round(pm10, 1),
                'o3': round(o3, 1),
                'no2': round(no2, 1),
                'so2': round(so2, 1),
                'co': round(co, 2),
                'aqi': round(aqi, 1)
            })
        
        return data
    
    def train_models(self, data, target_column='aqi'):
        """
        Train multiple ML models on the data
        """
        # Prepare data
        df = self.prepare_features(data)
        
        # Select features (exclude target and non-numeric columns)
        exclude_cols = [target_column, 'timestamp']
        feature_cols = [col for col in df.columns if col not in exclude_cols and df[col].dtype in ['int64', 'float64']]
        
        self.feature_names = feature_cols
        X = df[feature_cols]
        y = df[target_column]
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train each model
        for model_name, model in self.models.items():
            print(f"Training {model_name}...")
            
            if model_name == 'svm':
                # SVM works better with scaled data
                model.fit(X_train_scaled, y_train)
                y_pred = model.predict(X_test_scaled)
            else:
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
            
            # Calculate metrics
            mse = mean_squared_error(y_test, y_pred)
            rmse = np.sqrt(mse)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            # Cross-validation score
            if model_name == 'svm':
                cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='r2')
            else:
                cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='r2')
            
            self.trained_models[model_name] = model
            self.model_performance[model_name] = {
                'mse': mse,
                'rmse': rmse,
                'mae': mae,
                'r2': r2,
                'cv_mean': cv_scores.mean(),
                'cv_std': cv_scores.std()
            }
            
            print(f"{model_name} - R²: {r2:.3f}, RMSE: {rmse:.3f}, MAE: {mae:.3f}")
        
        return self.model_performance
    
    def predict(self, input_data, model_name='random_forest'):
        """
        Make predictions using trained model
        """
        if model_name not in self.trained_models:
            raise ValueError(f"Model {model_name} not trained yet")
        
        model = self.trained_models[model_name]
        
        # Prepare input data
        df = self.prepare_features([input_data])
        X = df[self.feature_names].iloc[0:1]
        
        if model_name == 'svm':
            X_scaled = self.scaler.transform(X)
            prediction = model.predict(X_scaled)[0]
        else:
            prediction = model.predict(X)[0]
        
        return max(0, prediction)  # Ensure non-negative prediction
    
    def predict_future(self, hours_ahead=24, model_name='random_forest'):
        """
        Predict future values based on current trends
        """
        predictions = []
        current_time = datetime.now()
        
        for i in range(hours_ahead):
            future_time = current_time + timedelta(hours=i)
            
            # Create synthetic input based on time patterns
            input_data = {
                'timestamp': future_time,
                'temp': 25 + 10 * np.sin(2 * np.pi * future_time.hour / 24),
                'humidity': 60 + np.random.normal(0, 10),
                'pressure': 1013 + np.random.normal(0, 5),
                'wind_speed': 5 + np.random.normal(0, 2),
                'visibility': 10 + np.random.normal(0, 2),
                'pm2_5': 35 + np.random.normal(0, 10),
                'pm10': 50 + np.random.normal(0, 15),
                'o3': 60 + np.random.normal(0, 15),
                'no2': 30 + np.random.normal(0, 8),
                'so2': 15 + np.random.normal(0, 5),
                'co': 1.2 + np.random.normal(0, 0.3)
            }
            
            try:
                prediction = self.predict(input_data, model_name)
                predictions.append({
                    'timestamp': future_time,
                    'predicted_aqi': round(prediction, 1),
                    'hour': future_time.hour
                })
            except Exception as e:
                print(f"Error predicting for {future_time}: {e}")
        
        return predictions
    
    def save_model(self, filepath='models/weather_aqi_model.joblib'):
        """
        Save trained models and preprocessing objects
        """
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        model_data = {
            'trained_models': self.trained_models,
            'scaler': self.scaler,
            'label_encoders': self.label_encoders,
            'model_performance': self.model_performance,
            'feature_names': self.feature_names
        }
        
        joblib.dump(model_data, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath='models/weather_aqi_model.joblib'):
        """
        Load trained models and preprocessing objects
        """
        if os.path.exists(filepath):
            model_data = joblib.load(filepath)
            self.trained_models = model_data['trained_models']
            self.scaler = model_data['scaler']
            self.label_encoders = model_data['label_encoders']
            self.model_performance = model_data['model_performance']
            self.feature_names = model_data['feature_names']
            print(f"Model loaded from {filepath}")
            return True
        return False
    
    def get_feature_importance(self, model_name='random_forest'):
        """
        Get feature importance for tree-based models
        """
        if model_name not in ['random_forest', 'gradient_boosting']:
            return None
        
        if model_name not in self.trained_models:
            return None
        
        model = self.trained_models[model_name]
        importances = model.feature_importances_
        
        feature_importance = list(zip(self.feature_names, importances))
        feature_importance.sort(key=lambda x: x[1], reverse=True)
        
        return feature_importance[:10]  # Top 10 features
    
    def get_model_info(self):
        """
        Get information about trained models and their performance
        """
        info = {
            'available_models': list(self.models.keys()),
            'trained_models': list(self.trained_models.keys()),
            'model_performance': self.model_performance,
            'feature_count': len(self.feature_names),
            'feature_names': self.feature_names,
            'scaler_fitted': hasattr(self.scaler, 'mean_')
        }
        
        # Add model-specific info
        for model_name, performance in self.model_performance.items():
            if model_name in self.trained_models:
                info[f'{model_name}_info'] = {
                    'r2_score': performance.get('r2_score', 0),
                    'mse': performance.get('mse', 0),
                    'mae': performance.get('mae', 0),
                    'trained': True
                }
        
        return info


# Initialize global model instance
prediction_model = WeatherAQIPredictionModel()