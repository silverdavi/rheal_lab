# Standard
from collections import OrderedDict
from enum import Enum, IntEnum
import json
from typing import Annotated, Dict, Iterable, List
# External
import numpy as np
# Internal
from common import apigw_handler, MAP_CLAIMS_CLINIC, Ethnicity, InfertilityCondition
from pgsql import PgSQL
from ValiDecor.validators import Between, IsType, LenBetween, ListOf, OneOf
from ValiDecor.validators import MapApiGatewayBody as MapB

AGE_EXTRA = [ 0, 1, 3, 5, 7 ]

AGE_MAX = 45.0
AGE_MIN = 20.0

AMH_PERCENTILES = {
    20: [ 9.78, 6.72, 5.22, 4.27, 3.60, 3.08, 2.67, 2.33, 2.04, 1.79, 1.58, 1.38, 1.21, 1.05, 0.90, 0.75, 0.62, 0.48, 0.33 ],
    22: [ 8.26, 5.68, 4.41, 3.61, 3.04, 2.60, 2.26, 1.97, 1.73, 1.52, 1.33, 1.17, 1.02, 0.88, 0.76, 0.64, 0.52, 0.40, 0.28 ],
    24: [ 6.85, 4.71, 3.66, 2.99, 2.52, 2.16, 1.87, 1.63, 1.43, 1.26, 1.10, 0.97, 0.85, 0.73, 0.63, 0.53, 0.43, 0.34, 0.23 ],
    26: [ 5.77, 3.96, 3.08, 2.52, 2.12, 1.82, 1.57, 1.37, 1.20, 1.06, 0.93, 0.81, 0.71, 0.62, 0.53, 0.44, 0.36, 0.28, 0.19 ],
    28: [ 4.96, 3.41, 2.65, 2.17, 1.82, 1.56, 1.35, 1.18, 1.04, 0.91, 0.80, 0.70, 0.61, 0.53, 0.45, 0.38, 0.31, 0.24, 0.17 ],
    30: [ 4.38, 3.02, 2.34, 1.92, 1.61, 1.38, 1.20, 1.04, 0.92, 0.80, 0.71, 0.62, 0.54, 0.47, 0.40, 0.34, 0.28, 0.21, 0.15 ],
    32: [ 4.02, 2.76, 2.15, 1.76, 1.48, 1.27, 1.10, 0.96, 0.84, 0.74, 0.65, 0.57, 0.50, 0.43, 0.37, 0.31, 0.25, 0.20, 0.14 ],
    34: [ 3.73, 2.56, 1.99, 1.63, 1.37, 1.18, 1.02, 0.89, 0.78, 0.68, 0.60, 0.53, 0.46, 0.40, 0.34, 0.29, 0.24, 0.18, 0.13 ],
    36: [ 3.28, 2.26, 1.75, 1.43, 1.21, 1.03, 0.90, 0.78, 0.69, 0.60, 0.53, 0.46, 0.41, 0.35, 0.30, 0.25, 0.21, 0.16, 0.11 ],
    38: [ 2.56, 1.76, 1.37, 1.12, 0.94, 0.81, 0.70, 0.61, 0.54, 0.47, 0.41, 0.36, 0.32, 0.27, 0.23, 0.20, 0.16, 0.13, 0.09 ],
    40: [ 1.70, 1.17, 0.91, 0.74, 0.63, 0.54, 0.46, 0.41, 0.36, 0.31, 0.27, 0.24, 0.21, 0.18, 0.16, 0.13, 0.11, 0.08, 0.06 ],
    42: [ 1.00, 0.69, 0.53, 0.44, 0.37, 0.31, 0.27, 0.24, 0.21, 0.18, 0.16, 0.14, 0.12, 0.11, 0.09, 0.08, 0.06, 0.05, 0.03 ],
    44: [ 0.54, 0.37, 0.29, 0.24, 0.20, 0.17, 0.15, 0.13, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.03, 0.02 ],
}

ATTRITION = OrderedDict([
    ('retrieved', {}),
    ('frozen', {
        30: (0.75, 0.8),
        35: (0.65, 0.7),
        40: (0.45, 0.5),
        45: (0.20, 0.25),
    }),
    ('thawed', {
        30: (0.85, 0.9),
        35: (0.8, 0.85),
        40: (0.7, 0.75),
        45: (0.55, 0.6),
    }),
    ('fertilized', {
        30: (0.75, 0.8),
        35: (0.65, 0.7),
        40: (0.55, 0.6),
        45: (0.45, 0.5),
    }),
    ('good_embryos', {
        30: (0.45, 0.5),
        35: (0.35, 0.4),
        40: (0.2, 0.25),
        45: (0.1, 0.125),
    }),
    ('implanted', {
        30: (0.55, 0.6),
        35: (0.45, 0.5),
        40: (0.35, 0.4),
        45: (0.25, 0.275),
    }),
    ('livebirth', {}),
])

BMI_MAX = 45.0
BMI_MIN = 15.0

CONDITION_FACTORS_BIRTH = {
    InfertilityCondition.ENDOMETRIOSIS: 0.8,
}

CONDITION_FACTORS_EGGS = {
    InfertilityCondition.ENDOMETRIOSIS: 0.9,
    InfertilityCondition.PCOS: 1.2,
}

DEFAULT_MODE = 'gauss2'

ETHNICITY_FACTORS = {
    Ethnicity.ASIAN: 0.82,
    Ethnicity.BLACK: 0.8,
    Ethnicity.OTHER: 0.85,
}

NG_ML_2_PM_L = 7.18

PARAMS_BMI = [ -4.439e-06, 0.0005938, -0.02932, 0.6203, -3.744 ]

ROUNDS_MAX = 3

class AmhUnit(IntEnum):
    NanoGramsPerMilliLitre = 0
    PicoMolesPerLitre = 1

pg = PgSQL(env = 'MY')

def amh_decline(age):
    return -0.02205 * np.exp(-((age - 30.57) / 12.36) ** 2)

def babies_cycles(p1: float, eggs: int):
    probs = []
    if eggs == 0:
        p2 = 0
    else:
        a = (1 - p1) ** (1  / eggs)
        p2 = 1 - (1 - p1) * (1 + eggs * (1 - a) / a)
    for n in range(1, 1 + ROUNDS_MAX):
        p_n_1 = 1 - (1 - p1) ** n
        p_n_2 = 1 - (1 - p1) ** n - n * (1 - p1) ** (n - 1) * (p1 - p2)
        probs.append([ prettify(p_n_1), prettify(p_n_2) ])
    return probs

def bmi_factor(bmi: float):
    return np.polyval(PARAMS_BMI, bmi)

def clbr_by_age(age):
    return 1 - (1 - lbr_by_age(age)) ** oocytes_by_age_old(age)

def compute_results(age: float, amh: float, bmi: float, 
        ethnicity: Iterable[Ethnicity],
        conditions: Iterable[InfertilityCondition],
        l_afc: int = None, r_afc: int = None,
    ):
    # normalize
    age0 = age
    age = float(np.clip(age, AGE_MIN, AGE_MAX))
    bmi = np.clip(bmi, BMI_MIN, BMI_MAX)
    # eggs
    health_factor_eggs = np.prod(factorize(conditions, CONDITION_FACTORS_EGGS))
    print('health_factor_eggs:', health_factor_eggs)
    eggs_normal = int(np.floor(oocytes_by_age_old(age) * health_factor_eggs))
    eggs = []
    eggs_tot = 0
    for i in range(ROUNDS_MAX):
        age_i = np.clip(age + i, AGE_MIN, AGE_MAX)
        eggs_i = oocytes_by_age_new(age_i) * health_factor_eggs
        norm_amh = normal_amh(age_i)
        fixed_amh = fix_amh_diff(amh, age, age_i)
        eggs_i *= gompertz(fixed_amh / norm_amh)
        eggs_i = int(np.floor(eggs_i))
        eggs_tot += eggs_i
        eggs.append(eggs_tot)
    # births
    clbr = clbr_by_age(age)
    clbr *= bmi_factor(bmi)
    clbr *= np.mean(factorize(ethnicity, ETHNICITY_FACTORS))
    clbr *= np.prod(factorize(conditions, CONDITION_FACTORS_BIRTH))
    lbr = 1 - (1 - clbr) ** (1 / eggs_normal)
    clbr = 1 - (1 - lbr) ** (eggs[0])
    births = babies_cycles(clbr, eggs[0])
    # Calculate number of eggs expected to be frozen successfully
    retrieved = eggs[0]
    if l_afc is None or r_afc is None:
        frozen = retrieved
    else:
        afc = l_afc + r_afc
        if amh is None:
            frozen = 0.8 * (retrieved + 0.2 * afc)
        else:
            orpi = (amh * afc) / age
            if InfertilityCondition.PCOS in conditions:
                frozen = 0.65 * retrieved + 0.35 * orpi * 0.9
            else:
                frozen = 0.65 * retrieved + 0.35 * orpi
    # Calculate attrition rates
    thawed = frozen * get_attrition_rate(age, 'thawed')
    fertilized = thawed * get_attrition_rate(age, 'fertilized')
    good_embryos = fertilized * get_attrition_rate(age, 'good_embryos')
    implanted = good_embryos * get_attrition_rate(age, 'implanted')
    # Apply patient-specific factors
    implanted *= bmi_factor(bmi)
    implanted *= np.mean(factorize(ethnicity, ETHNICITY_FACTORS))
    implanted *= np.prod(factorize(conditions, CONDITION_FACTORS_BIRTH))
    # Calculate livebirths
    livebirth = implanted * 0.8
    attrition = {
        'retrieved': retrieved,
        'frozen': int(np.ceil(frozen)),
        'thawed': int(np.ceil(thawed)),
        'fertilized': int(np.ceil(fertilized)),
        'good_embryos': int(np.ceil(good_embryos)),
        'implanted': int(np.ceil(implanted)),
        'livebirth': int(np.ceil(livebirth)),
    }
    return {
        'age': round(age0),
        'births': births,
        'eggs': eggs,
        'attrition': attrition,
        'attrition_graph': get_attrition_points(attrition)
    }

def factorize(props: Iterable[Enum], factors: Dict[Enum, float]):
    if len(props) == 0:
        return [ 1.0 ]
    return [ factors.get(p, 1.0) for p in props ]

def fix_amh(old_amh, old_age, new_age):
    if new_age == old_age:
        return old_amh
    old_age = np.clip(old_age, AGE_MIN, AGE_MAX)
    old_age_bracket = old_age - old_age % 2
    amh_list = AMH_PERCENTILES[old_age_bracket]
    percentile_index = 0
    while percentile_index + 1 < len(amh_list) and old_amh < amh_list[percentile_index]:
        percentile_index += 1
    amh_factor = old_amh / amh_list[percentile_index]
    new_age = np.clip(new_age, AGE_MIN, AGE_MAX)
    new_age_bracket = new_age - new_age % 2
    new_amh = amh_factor * AMH_PERCENTILES[new_age_bracket][percentile_index]
    return new_amh

def fix_amh_diff(old_amh, old_age, new_age):
    new_amh = old_amh + amh_decline(0.5 * (new_age + old_age)) * (new_age - old_age)
    return new_amh

def get_attrition_points(attrition_dict):
    left = [ float(attrition_dict[stage]) for stage in ATTRITION ]
    right = left[1:] + [ left[-1] * 0.9 ]
    result = {
        stage: {
            'left': round(l, 1),
            'middle': round((l + r) / 2 + min(0.075 * (l - r), 0.25), 1),
            'right': round(r, 1)
        } for stage, l, r in zip(ATTRITION, left, right)
    }
    return result

def get_attrition_rate(age: float, stage: str) -> float:
    rates = ATTRITION.get(stage, {})
    ages = sorted(rates.keys())
    if age <= ages[0]:
        return np.mean(rates[ages[0]])
    if age >= ages[-1]:
        return np.mean(rates[ages[-1]])

    for age_lo, age_hi in zip(ages[:-1], ages[1:]):
        if age < age_hi:
            break
    rate_lo = np.mean(rates[age_lo])
    rate_hi = np.mean(rates[age_hi])
    age_ratio = (age - age_lo) / (age_hi - age_lo)
    return rate_lo + age_ratio * (rate_hi - rate_lo)

def gompertz(x):
    A = 0.9
    K = 4.52
    T = 0.8
    S = 0.4
    y = A * np.exp(-np.exp(-K * (x - T))) + S
    return y

def lbr_by_age(age):
    # params = [ 11.11, 0.45, 38, 0.44]
    params = [ 13, 1.5, 33, 0.5 ]
    return sigmoid(age, *params) / 100

def normal_amh(age):
    params = [ 4.6, -0.12, 30.5, 0.17 ]
    return sigmoid(age, *params)

def oocytes_by_age_new(age):
    params = [-1.4, 22, 37,-0.13]
    return sigmoid(age, *params)

def oocytes_by_age_old(age):
    params = [ 22, 2, 38, 0.41 ]
    return sigmoid(age, *params)

def prettify(prob: float):
    return round(prob * 100)
    # return round(prob * 10000) / 100

def sigmoid(x, a, b, c, d):
    y = a + (b - a) / (1 + np.exp(-(x - c) * d))
    return y

# /post
@apigw_handler
def handler(
        clinic: Annotated[str, MAP_CLAIMS_CLINIC],
        patient: Annotated[str, MapB('name'), IsType(), LenBetween(2, 32)],
        age: Annotated[int, MapB('age'), IsType(), Between(15, 50)],
        height: Annotated[int, MapB('height'), IsType(), Between(120, 200)], # height in cm
        weight: Annotated[int, MapB('weight'), IsType(), Between(40, 160)], # weight in kg
        amh_value: Annotated[float, MapB('amh_value', float)] = None,
        amh_units: Annotated[int, MapB('amh_units'),
                             IsType(),
                             OneOf(*[ e.value for e in AmhUnit ])] = AmhUnit.NanoGramsPerMilliLitre.value,
        bmi: Annotated[float, MapB('bmi', float)] = None,
        condition: Annotated[List[int], MapB('condition'),
                             ListOf(*[ e.value for e in InfertilityCondition ])] = [],
        ethnicity: Annotated[List[int], MapB('ethnicity'), 
                             LenBetween(hi = 4),
                             ListOf(*[ e.value for e in Ethnicity ])] = [],
    ):
    # 1 ng/ml = 7.18 pmol/l.
    qvars = {
        'clinic': clinic,
        'patient': patient,
        'age': age,
        'height': height,
        'weight': weight,
        'amh_value': amh_value,
        'amh_units': amh_units,
        'bmi': bmi,
        'condition': json.dumps(condition, default = str),
        'ethnicity': json.dumps(ethnicity, default = str),
    }
    row = pg.exec_fetch_one('fertility/cycle_create', qvars)
    print('cycle:', json.dumps(row, default = str))
    if bmi is None:
        bmi = weight / (height ** 2)
    if amh_value is not None and amh_units == AmhUnit.PicoMolesPerLitre.value:
        amh_value = amh_value / NG_ML_2_PM_L
    famh = normal_amh if amh_value is None else lambda ay: fix_amh_diff(amh_value, age, ay)
    conditions = set(map(InfertilityCondition, condition))
    ethnicity = set(map(Ethnicity, ethnicity))
    results = [ compute_results(age + y, famh(age + y), bmi, ethnicity, conditions) for y in AGE_EXTRA ]
    print('results:', results)
    return { "results": results }