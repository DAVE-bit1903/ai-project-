"""
train_model.py - MindCheck ML model trainer
Generates balanced synthetic data, trains a RandomForestClassifier, saves model.pkl.

Questions q1-q15 take values 0-3.
Reverse-scored (q3,q7,q9,q13,q15): contribution = 3 - raw_value
Total score -> label:
   0-15  -> 0 (low)
  16-32  -> 1 (mid)
  33-45  -> 2 (high)
"""

import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

RANDOM_SEED = 42
N_PER_CLASS = 2000
REVERSE_IDX = [2, 6, 8, 12, 14]   # 0-indexed positions of q3,q7,q9,q13,q15

rng = np.random.default_rng(RANDOM_SEED)

# ---- Generate samples for each class ----------------------------------------

# LOW (score 0-15): forward questions -> 0-1, reverse questions raw -> 2-3
X_low = rng.integers(0, 2, size=(N_PER_CLASS, 15)).astype(float)
X_low[:, REVERSE_IDX] = rng.integers(2, 4, size=(N_PER_CLASS, 5))

# MID (score 16-32): forward questions -> 1-2, reverse questions raw -> 1-2
X_mid = rng.integers(1, 3, size=(N_PER_CLASS, 15)).astype(float)
X_mid[:, REVERSE_IDX] = rng.integers(1, 3, size=(N_PER_CLASS, 5))

# HIGH (score 33-45): forward questions -> 2-3, reverse questions raw -> 0-1
X_high = rng.integers(2, 4, size=(N_PER_CLASS, 15)).astype(float)
X_high[:, REVERSE_IDX] = rng.integers(0, 2, size=(N_PER_CLASS, 5))

X = np.vstack([X_low, X_mid, X_high])
y = np.array([0]*N_PER_CLASS + [1]*N_PER_CLASS + [2]*N_PER_CLASS)

# ---- Verify score ranges ----------------------------------------------------
def score(row):
    s = row.copy()
    for i in REVERSE_IDX:
        s[i] = 3 - s[i]
    return s.sum()

scores = np.array([score(X[i]) for i in range(len(X))])
print("Score ranges per class:")
for lbl, name in enumerate(["low", "mid", "high"]):
    m = y == lbl
    print(f"  {name}: min={scores[m].min():.0f}  max={scores[m].max():.0f}  mean={scores[m].mean():.1f}")

# ---- Train ------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
)

clf = RandomForestClassifier(
    n_estimators=200, max_depth=10,
    class_weight="balanced", random_state=RANDOM_SEED, n_jobs=-1,
)
clf.fit(X_train, y_train)

# ---- Evaluate ---------------------------------------------------------------
y_pred = clf.predict(X_test)
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["low", "mid", "high"]))

# ---- Save -------------------------------------------------------------------
joblib.dump(clf, "model.pkl")
print("DONE: model.pkl saved successfully!")
