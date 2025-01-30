import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import os
import matplotlib.pyplot as plt
import numpy as np


# File paths
data_folder = "data"
high_popularity_file = os.path.join(data_folder, "high_popularity_spotify_data.csv")
low_popularity_file = os.path.join(data_folder, "low_popularity_spotify_data.csv")

# Load datasets
high_popularity_data = pd.read_csv(high_popularity_file)
low_popularity_data = pd.read_csv(low_popularity_file)

# Combine datasets
data = pd.concat([high_popularity_data, low_popularity_data], ignore_index=True)

# Select audio features for PCA
features = ['energy', 'tempo', 'danceability', 'loudness', 'liveness', 'valence', 'speechiness', 'instrumentalness', 'mode', 'key', 'duration_ms', 'acousticness']

# Drop rows with missing values in the selected features
data = data.dropna(subset=features)

# Standardize the features
scaler = StandardScaler()
scaled_features = scaler.fit_transform(data[features])

# Perform PCA
pca = PCA(n_components=2)  # Reduce to 2 dimensions for visualization
pca_result = pca.fit_transform(scaled_features)

# Add PCA results to the original dataframe
data['pca_x'] = pca_result[:, 0]
data['pca_y'] = pca_result[:, 1]

# Use Elbow Method to determine optimal number of clusters
inertia = []  # Sum of squared distances to closest cluster center
cluster_range = range(1, 11)  # Test cluster sizes from 1 to 10

""" for k in cluster_range:
    kmeans = KMeans(n_clusters=k, random_state=42)
    kmeans.fit(pca_result)
    inertia.append(kmeans.inertia_)

# Plot the Elbow Method results
plt.figure(figsize=(8, 5))
plt.plot(cluster_range, inertia, marker='o', linestyle='--')
plt.title('Elbow Method for Optimal K')
plt.xlabel('Number of Clusters (k)')
plt.ylabel('Inertia')
plt.grid(True)
plt.show() """

# Choose the optimal number of clusters based on the Elbow Method
optimal_clusters = 4  # Adjust this based on the Elbow Method plot

# Perform clustering with the optimal number of clusters
kmeans = KMeans(n_clusters=optimal_clusters, random_state=42)
data['cluster'] = kmeans.fit_predict(pca_result)

# Plot the PCA results with clustering
plt.figure(figsize=(10, 7))
for cluster in range(optimal_clusters):
    cluster_data = data[data['cluster'] == cluster]
    plt.scatter(cluster_data['pca_x'], cluster_data['pca_y'], label=f'Cluster {cluster}', alpha=0.6)
plt.title(f'PCA of Spotify Data with {optimal_clusters} Clusters')
plt.xlabel('PCA Component 1')
plt.ylabel('PCA Component 2')
plt.legend()
plt.grid(True)
plt.show()

# Save the resulting dataset with PCA components and clusters
output_file = os.path.join(data_folder, "pca_results_with_clusters.csv")
data.to_csv(output_file, index=False)

print(f"PCA results with clustering saved to {output_file}")