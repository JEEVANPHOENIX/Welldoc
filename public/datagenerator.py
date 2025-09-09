import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

class MedicalDatasetGenerator:
    def __init__(self, n_patients=15000, months=6):
        self.n_patients = n_patients
        self.months = months
        self.days_total = months * 30
        
        # Set random seed for reproducibility
        np.random.seed(42)
        random.seed(42)
        
    def generate_demographics(self):
        """Generate realistic patient demographics"""
        demographics = []
        
        for i in range(self.n_patients):
            # Age distribution: 25% young (18-40), 35% middle (41-65), 40% older (65+)
            age_group = np.random.choice(['young', 'middle', 'older'], p=[0.25, 0.35, 0.40])
            if age_group == 'young':
                age = np.random.randint(18, 41)
            elif age_group == 'middle':
                age = np.random.randint(41, 66)
            else:
                age = np.random.randint(66, 91)
            
            sex = np.random.choice(['M', 'F'], p=[0.48, 0.52])
            race = np.random.choice(['Caucasian', 'African_American', 'Hispanic', 'Asian', 'Other'], 
                                  p=[0.60, 0.20, 0.12, 0.05, 0.03])
            
            # Height and weight with realistic correlations
            if sex == 'M':
                height_cm = np.random.normal(175.3, 7.1)  # Male average
                base_bmi = np.random.normal(26.6, 4.2)
            else:
                height_cm = np.random.normal(161.8, 6.5)  # Female average  
                base_bmi = np.random.normal(25.4, 5.1)
            
            # Age affects BMI
            age_bmi_factor = 1 + (age - 30) * 0.005 if age > 30 else 1
            bmi = base_bmi * age_bmi_factor
            bmi = np.clip(bmi, 16, 50)  # Realistic BMI range
            
            weight_kg = bmi * (height_cm/100)**2
            
            demographics.append({
                'patient_id': f'PAT_{i+1:06d}',
                'age': int(age),
                'sex': sex,
                'race': race,
                'height_cm': round(height_cm, 1),
                'weight_kg': round(weight_kg, 1),
                'bmi': round(bmi, 1)
            })
            
        return pd.DataFrame(demographics)
    
    def assign_conditions(self, demographics):
        """Assign medical conditions with realistic prevalence and correlations"""
        conditions = []
        
        for _, patient in demographics.iterrows():
            age = patient['age']
            bmi = patient['bmi']
            sex = patient['sex']
            
            # Age-based disease probabilities
            diabetes_prob = 0.05 + (age - 18) * 0.003 + max(0, bmi - 25) * 0.02
            hf_prob = 0.01 + max(0, age - 50) * 0.002
            ckd_prob = 0.02 + max(0, age - 40) * 0.001
            htn_prob = 0.15 + (age - 18) * 0.01
            
            # Generate conditions
            has_diabetes = np.random.random() < diabetes_prob
            diabetes_type = 'none'
            if has_diabetes:
                # Type 1 much more likely if young
                if age < 30:
                    diabetes_type = 'type1' if np.random.random() < 0.15 else 'type2'
                else:
                    diabetes_type = 'type2'
            
            has_hf = np.random.random() < hf_prob
            has_ckd = np.random.random() < ckd_prob
            has_htn = np.random.random() < htn_prob
            
            # Obesity classification
            obesity_class = 'normal'
            if bmi >= 30:
                if bmi >= 40:
                    obesity_class = 'class3'
                elif bmi >= 35:
                    obesity_class = 'class2'
                else:
                    obesity_class = 'class1'
            elif bmi >= 25:
                obesity_class = 'overweight'
            
            conditions.append({
                'patient_id': patient['patient_id'],
                'has_diabetes': has_diabetes,
                'diabetes_type': diabetes_type,
                'has_heart_failure': has_hf,
                'has_ckd': has_ckd,
                'has_hypertension': has_htn,
                'obesity_class': obesity_class
            })
            
        return pd.DataFrame(conditions)
    
    def generate_biomarkers(self, demographics, conditions):
        """Generate realistic biomarker values with medical correlations"""
        biomarkers = []
        
        for _, patient in demographics.iterrows():
            patient_id = patient['patient_id']
            age = patient['age']
            sex = patient['sex']
            bmi = patient['bmi']
            
            # Get conditions
            patient_conditions = conditions[conditions['patient_id'] == patient_id].iloc[0]
            
            # Blood Pressure (correlated with age, BMI, hypertension)
            base_sbp = 120 + (age - 30) * 0.5 + (bmi - 25) * 0.8
            if patient_conditions['has_hypertension']:
                base_sbp += np.random.normal(20, 10)
            sbp = np.clip(np.random.normal(base_sbp, 15), 90, 220)
            
            base_dbp = 80 + (age - 30) * 0.2 + (bmi - 25) * 0.3
            if patient_conditions['has_hypertension']:
                base_dbp += np.random.normal(10, 5)
            dbp = np.clip(np.random.normal(base_dbp, 8), 50, 130)
            
            # Heart Rate
            hr = np.clip(np.random.normal(72, 12), 45, 120)
            
            # HbA1c (strongly correlated with diabetes)
            if patient_conditions['diabetes_type'] == 'none':
                hba1c = np.random.normal(5.3, 0.4)
            elif patient_conditions['diabetes_type'] == 'type1':
                hba1c = np.random.normal(7.8, 1.5)  # Often higher in T1D
            else:  # type2
                hba1c = np.random.normal(7.2, 1.2)
            hba1c = np.clip(hba1c, 4.0, 14.0)
            
            # Fasting Glucose (correlated with HbA1c)
            glucose_base = 83 + (hba1c - 5.3) * 25
            fasting_glucose = np.clip(np.random.normal(glucose_base, 20), 70, 400)
            
            # eGFR (kidney function - decreases with age, diabetes, HTN)
            base_egfr = 120 - (age - 20) * 0.8
            if patient_conditions['has_diabetes']:
                base_egfr -= np.random.normal(15, 10)
            if patient_conditions['has_hypertension']:
                base_egfr -= np.random.normal(8, 5)
            if patient_conditions['has_ckd']:
                base_egfr = np.random.uniform(15, 60)
            egfr = np.clip(base_egfr, 10, 150)
            
            # Creatinine (inverse relationship with eGFR, higher in males)
            if sex == 'M':
                creatinine = 1.2 + (120 - egfr) * 0.02
            else:
                creatinine = 1.0 + (120 - egfr) * 0.015
            creatinine = np.clip(creatinine, 0.5, 8.0)
            
            # BNP (heart failure marker)
            if patient_conditions['has_heart_failure']:
                bnp = np.random.lognormal(6.2, 0.8)  # Elevated in HF
            else:
                bnp = np.random.lognormal(3.5, 0.6)  # Normal range
            bnp = np.clip(bnp, 10, 5000)
            
            # Ejection Fraction
            if patient_conditions['has_heart_failure']:
                ef = np.random.normal(35, 12)  # Reduced in HF
            else:
                ef = np.random.normal(62, 8)   # Normal
            ef = np.clip(ef, 15, 75)
            
            # Lipid Panel
            total_chol = np.random.normal(200, 40)
            ldl = np.random.normal(115, 35)
            if sex == 'M':
                hdl = np.random.normal(45, 12)
            else:
                hdl = np.random.normal(55, 15)
            
            triglycerides = np.random.lognormal(4.7, 0.5)
            if patient_conditions['has_diabetes']:
                triglycerides *= 1.4  # Higher in diabetes
            
            biomarkers.append({
                'patient_id': patient_id,
                'systolic_bp': round(sbp, 0),
                'diastolic_bp': round(dbp, 0),
                'heart_rate': round(hr, 0),
                'hba1c': round(hba1c, 1),
                'fasting_glucose': round(fasting_glucose, 0),
                'egfr': round(egfr, 0),
                'creatinine': round(creatinine, 2),
                'bnp': round(bnp, 0),
                'ejection_fraction': round(ef, 0),
                'total_cholesterol': round(total_chol, 0),
                'ldl_cholesterol': round(ldl, 0),
                'hdl_cholesterol': round(hdl, 0),
                'triglycerides': round(triglycerides, 0)
            })
            
        return pd.DataFrame(biomarkers)
    
    def generate_lifestyle_adherence(self, demographics, conditions):
        """Generate lifestyle and medication adherence data"""
        lifestyle = []
        
        for _, patient in demographics.iterrows():
            patient_id = patient['patient_id']
            age = patient['age']
            
            # Smoking (decreases with age)
            smoke_prob = max(0.05, 0.25 - (age - 18) * 0.003)
            if np.random.random() < smoke_prob:
                smoking_status = 'current'
                cigs_per_day = np.random.poisson(12)
            elif np.random.random() < 0.25:  # Former smokers
                smoking_status = 'former'
                cigs_per_day = 0
            else:
                smoking_status = 'never'
                cigs_per_day = 0
            
            # Exercise (decreases with age)
            base_exercise = max(0, 200 - (age - 30) * 2)
            exercise_weekly = np.clip(np.random.exponential(base_exercise), 0, 600)
            
            # Sleep
            sleep_hours = np.clip(np.random.normal(7.5, 1.2), 4, 11)
            
            # Alcohol
            alcohol_weekly = np.clip(np.random.exponential(3), 0, 30)
            
            # Stress level
            stress_level = np.random.randint(1, 11)
            
            # Medication adherence (higher in older patients)
            base_adherence = min(0.9, 0.5 + (age - 18) * 0.008)
            
            patient_conditions = conditions[conditions['patient_id'] == patient_id].iloc[0]
            
            ace_adherence = np.random.beta(base_adherence * 10, (1-base_adherence) * 10) if patient_conditions['has_hypertension'] or patient_conditions['has_heart_failure'] else 0
            beta_adherence = np.random.beta(base_adherence * 10, (1-base_adherence) * 10) if patient_conditions['has_heart_failure'] else 0
            statin_adherence = np.random.beta((base_adherence * 0.8) * 10, (1-base_adherence * 0.8) * 10)  # Statins have lower adherence
            diabetes_adherence = np.random.beta(base_adherence * 12, (1-base_adherence) * 12) if patient_conditions['has_diabetes'] else 0
            
            lifestyle.append({
                'patient_id': patient_id,
                'smoking_status': smoking_status,
                'cigarettes_per_day': cigs_per_day,
                'alcohol_drinks_weekly': round(alcohol_weekly, 1),
                'exercise_minutes_weekly': round(exercise_weekly, 0),
                'sleep_hours_nightly': round(sleep_hours, 1),
                'stress_level': stress_level,
                'ace_inhibitor_adherence': round(ace_adherence, 2),
                'beta_blocker_adherence': round(beta_adherence, 2),
                'statin_adherence': round(statin_adherence, 2),
                'diabetes_med_adherence': round(diabetes_adherence, 2)
            })
            
        return pd.DataFrame(lifestyle)
    
    def calculate_risk_scores(self, merged_data):
        """Calculate realistic risk scores based on clinical factors"""
        risk_scores = []
        
        for _, patient in merged_data.iterrows():
            score = 0
            
            # Cardiovascular Risk Factors
            if patient['systolic_bp'] >= 140:
                score += 15
            if patient['systolic_bp'] >= 160:
                score += 10  # Additional points for severe HTN
                
            # HDL targets (sex-specific)
            if (patient['sex'] == 'M' and patient['hdl_cholesterol'] < 40) or \
               (patient['sex'] == 'F' and patient['hdl_cholesterol'] < 50):
                score += 10
                
            if patient['smoking_status'] == 'current':
                score += 20
                
            if patient['age'] > 65:
                score += 10
                
            # Diabetes Complications
            if patient['hba1c'] > 9.0:
                score += 25
            elif patient['hba1c'] > 8.0:
                score += 15
                
            if patient['egfr'] < 60:
                score += 15
            if patient['egfr'] < 30:
                score += 15  # Additional points for severe CKD
                
            # Heart Failure Severity
            if patient['has_heart_failure']:
                if patient['ejection_fraction'] < 40:
                    score += 30
                if patient['bnp'] > 1000:
                    score += 20
                elif patient['bnp'] > 400:
                    score += 10
                    
            # Lifestyle and Adherence
            avg_adherence = np.mean([
                patient['ace_inhibitor_adherence'],
                patient['beta_blocker_adherence'], 
                patient['statin_adherence'],
                patient['diabetes_med_adherence']
            ])
            
            if avg_adherence < 0.5:
                score += 15
            elif avg_adherence < 0.7:
                score += 8
                
            if patient['bmi'] > 35:
                score += 10
            elif patient['bmi'] > 30:
                score += 5
                
            if patient['exercise_minutes_weekly'] < 75:
                score += 10
                
            # Assign risk levels
            if score <= 30:
                risk_level = 'low'
                risk_prob = [0.85, 0.12, 0.025, 0.005]  # [low, moderate, high, critical]
            elif score <= 60:
                risk_level = 'moderate' 
                risk_prob = [0.30, 0.55, 0.13, 0.02]
            elif score <= 90:
                risk_level = 'high'
                risk_prob = [0.10, 0.25, 0.55, 0.10]
            else:
                risk_level = 'critical'
                risk_prob = [0.02, 0.08, 0.30, 0.60]
                
            risk_scores.append({
                'patient_id': patient['patient_id'],
                'risk_score': score,
                'risk_level': risk_level,
                'prob_low': risk_prob[0],
                'prob_moderate': risk_prob[1], 
                'prob_high': risk_prob[2],
                'prob_critical': risk_prob[3]
            })
            
        return pd.DataFrame(risk_scores)
    
    def generate_complete_dataset(self):
        """Generate the complete medical dataset"""
        print("Generating demographics...")
        demographics = self.generate_demographics()
        
        print("Assigning medical conditions...")
        conditions = self.assign_conditions(demographics)
        
        print("Generating biomarkers...")
        biomarkers = self.generate_biomarkers(demographics, conditions)
        
        print("Generating lifestyle data...")
        lifestyle = self.generate_lifestyle_adherence(demographics, conditions)
        
        # Merge all dataframes
        print("Merging datasets...")
        merged = demographics.merge(conditions, on='patient_id')
        merged = merged.merge(biomarkers, on='patient_id')
        merged = merged.merge(lifestyle, on='patient_id')
        
        # Calculate risk scores
        print("Calculating risk scores...")
        risk_data = self.calculate_risk_scores(merged)
        final_dataset = merged.merge(risk_data, on='patient_id')
        
        print(f"Dataset generated: {len(final_dataset)} patients")
        print(f"Risk distribution:")
        print(final_dataset['risk_level'].value_counts(normalize=True))
        
        return final_dataset

# Generate the dataset
if __name__ == "__main__":
    generator = MedicalDatasetGenerator(n_patients=15000, months=6)
    dataset = generator.generate_complete_dataset()
    
    # Save to CSV
    dataset.to_csv('medical_dataset_realistic.csv', index=False)
    print("Dataset saved as 'medical_dataset_realistic.csv'")
    
    # Print summary statistics
    print("\nDataset Summary:")
    print(f"Shape: {dataset.shape}")
    print(f"Columns: {list(dataset.columns)}")
    print(f"\nKey Statistics:")
    print(f"Mean age: {dataset['age'].mean():.1f}")
    print(f"Mean BMI: {dataset['bmi'].mean():.1f}")
    print(f"Diabetes prevalence: {(dataset['has_diabetes']).mean():.2%}")
    print(f"Hypertension prevalence: {(dataset['has_hypertension']).mean():.2%}")