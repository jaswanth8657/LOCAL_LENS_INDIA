import numpy as np
from typing import List, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class TFIDFRecommendationEngine:
    """
    Scikit-learn TF-IDF Vectorization and Cosine Similarity calculation engine.
    Computes genuine semantic relevance between user travel criteria and verified place records.
    """

    def __init__(self, stop_words: str = 'english', sublinear_tf: bool = True):
        self.stop_words = stop_words
        self.sublinear_tf = sublinear_tf

    def compute_similarity(
        self,
        place_documents: List[str],
        user_query_doc: str
    ) -> List[float]:
        """
        Computes cosine similarity between user query and place documents.
        Returns a list of similarity floats in range [0.0, 1.0].
        """
        if not place_documents:
            return []

        # Edge case: If query document is empty or whitespace
        if not user_query_doc or not user_query_doc.strip():
            return [0.0] * len(place_documents)

        # Corpus includes all place documents plus the user query
        corpus = place_documents + [user_query_doc]

        try:
            vectorizer = TfidfVectorizer(
                stop_words=self.stop_words,
                token_pattern=r'(?u)\b\w+\b',
                sublinear_tf=self.sublinear_tf,
                ngram_range=(1, 2),  # unigrams and bigrams
            )
            tfidf_matrix = vectorizer.fit_transform(corpus)
        except ValueError:
            # Empty vocabulary or completely stop-words
            return [0.0] * len(place_documents)

        # Separate place vectors from user vector
        place_vectors = tfidf_matrix[:-1]
        user_vector = tfidf_matrix[-1:]

        # Compute cosine similarity
        similarities = cosine_similarity(user_vector, place_vectors)[0]

        # Clean numerical bounds [0.0, 1.0]
        results = [float(np.clip(val, 0.0, 1.0)) for val in similarities]
        return results

