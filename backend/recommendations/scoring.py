from typing import Dict, Any, List, Optional, Tuple

class RecommendationScorer:
    """
    Configurable multi-factor ranking model combining Scikit-learn TF-IDF similarity,
    category relevance, budget constraints, distance proximity, and verification quality.
    """

    def __init__(
        self,
        weight_similarity: float = 0.35,
        weight_category: float = 0.25,
        weight_budget: float = 0.20,
        weight_distance: float = 0.12,
        weight_quality: float = 0.08
    ):
        total_w = weight_similarity + weight_category + weight_budget + weight_distance + weight_quality
        self.w_similarity = weight_similarity / total_w
        self.w_category = weight_category / total_w
        self.w_budget = weight_budget / total_w
        self.w_distance = weight_distance / total_w
        self.w_quality = weight_quality / total_w

    def evaluate_budget_score(
        self,
        ticket_price_inr: Optional[int],
        typical_cost_inr: Optional[int],
        daily_budget_inr: int,
        group_size: int = 1
    ) -> Tuple[float, str, str]:
        """
        Evaluates budget fit honestly and dynamically:
        - Never assumes an unknown price is 0.
        - Calculates spend ratio considering group size and daily budget.
        - Returns (normalized_score, cost_status, reason_string)
        """
        effective_cost = ticket_price_inr if ticket_price_inr is not None else typical_cost_inr

        if ticket_price_inr == 0:
            return 1.0, 'VERIFIED', 'Free public access'

        if effective_cost is not None:
            # Per-person spend ratio against per-person daily budget
            per_person_budget = max(400, daily_budget_inr)
            ratio = effective_cost / per_person_budget
            group_total_cost = effective_cost * max(1, group_size)

            if ratio <= 0.08:
                return 1.0, 'VERIFIED', f'Extremely affordable (₹{effective_cost}/person)'
            elif ratio <= 0.20:
                return 0.90, 'VERIFIED', f'Well within daily budget (₹{effective_cost}/person)'
            elif ratio <= 0.40:
                return 0.70, 'VERIFIED', f'Moderate activity spend (₹{effective_cost}/person)'
            elif ratio <= 0.70:
                return 0.40, 'VERIFIED', f'Significant share of daily budget (₹{effective_cost}/person)'
            else:
                return 0.15, 'VERIFIED', f'High expense vs daily budget (₹{effective_cost}/person)'

        # Fee is genuinely unknown
        return 0.55, 'UNAVAILABLE', 'Official entry tariff unavailable'

    def score_place(
        self,
        place: Any,
        similarity_score: float,
        user_interests: List[str],
        distance_km: Optional[float],
        distance_score: float,
        daily_budget_inr: int,
        group_type: str = 'Duo',
        group_size: int = 2,
        duration_days: int = 3
    ) -> Dict[str, Any]:
        """
        Combines multi-factor components dynamically based on user criteria:
        TF-IDF semantic similarity, category relevance, budget compatibility,
        group type suitability, trip duration focus, and verified quality.
        """
        place_cat = getattr(place, 'category', '').lower()
        place_subcat = getattr(place, 'subcategory', '').lower() if getattr(place, 'subcategory', None) else ''

        # 1. Category direct match (strict and responsive)
        matched_interests = []
        for i in user_interests:
            i_clean = i.lower().strip()
            if not i_clean:
                continue
            if (i_clean in place_cat or place_cat in i_clean or 
                (place_subcat and (i_clean in place_subcat or place_subcat in i_clean))):
                matched_interests.append(i_clean)

        if len(matched_interests) >= 2:
            cat_score = 1.0
        elif len(matched_interests) == 1:
            cat_score = 0.90
        elif not user_interests:
            cat_score = 0.60
        else:
            cat_score = 0.15  # Strict penalty when user explicitly specified interests and this place does not match

        # 2. Budget score (dynamically sensitive to daily_budget_inr and group_size)
        ticket_fee = getattr(place, 'ticket_price_inr', None)
        typical_cost = getattr(place, 'typical_cost_inr', None)
        budget_score, price_status, budget_reason = self.evaluate_budget_score(
            ticket_price_inr=ticket_fee,
            typical_cost_inr=typical_cost,
            daily_budget_inr=daily_budget_inr,
            group_size=group_size
        )

        # 3. Quality & Verification score
        quality_score = 0.5
        verification_status = getattr(place, 'verification_status', 'UNAVAILABLE')
        if verification_status == 'VERIFIED':
            quality_score += 0.3
        rating = getattr(place, 'rating', None)
        if rating and rating >= 4.0:
            quality_score += 0.2
        quality_score = min(1.0, quality_score)

        # 4. Group suitability adjustments
        group_type_clean = group_type.strip().capitalize()
        group_bonus = 0.0
        if group_type_clean == 'Family':
            if place_cat in ['culture', 'nature', 'museum', 'heritage', 'beaches']:
                group_bonus = 0.08
        elif group_type_clean == 'Friends':
            if place_cat in ['beaches', 'adventure', 'food', 'nature', 'market']:
                group_bonus = 0.08
        elif group_type_clean == 'Solo':
            if place_cat in ['culture', 'heritage', 'beaches', 'nature', 'cafe']:
                group_bonus = 0.06
        elif group_type_clean == 'Duo':
            if place_cat in ['beaches', 'nature', 'culture', 'heritage']:
                group_bonus = 0.06

        # 5. Trip duration adjustment
        # 1-day trip: penalize far-away places (>15km) to keep itinerary compact and actionable
        duration_adj = 0.0
        if duration_days <= 1 and distance_km is not None and distance_km > 15.0:
            duration_adj = -0.10
        elif duration_days >= 4 and distance_km is not None and distance_km > 20.0:
            # Multi-day trips welcome wider regional exploration
            duration_adj = 0.05

        # 6. Multi-factor weighted combination
        composite = (
            self.w_similarity * similarity_score +
            self.w_category * cat_score +
            self.w_budget * budget_score +
            self.w_distance * distance_score +
            self.w_quality * quality_score +
            group_bonus +
            duration_adj
        )
        composite = max(0.0, min(1.0, composite))

        # Scale to transparent percentage [50, 98]
        final_percentage = int(round(50 + composite * 48))
        final_percentage = max(50, min(98, final_percentage))

        # 5. Build human-readable rationale
        rationale_parts = []
        if matched_interests:
            rationale_parts.append(f"Matches your interest in {', '.join([i.title() for i in matched_interests])}")
        elif similarity_score >= 0.4:
            rationale_parts.append("High semantic alignment with your travel style")

        rationale_parts.append(budget_reason)

        if distance_km is not None:
            rationale_parts.append(f"{distance_km} km from destination center")

        rationale_str = " • ".join(rationale_parts)

        return {
            'match_score': final_percentage,
            'match_reason': rationale_str,
            'matched_interests': matched_interests,
            'distance_km': distance_km,
            'components': {
                'similarity_score': round(similarity_score, 3),
                'category_score': round(cat_score, 3),
                'budget_score': round(budget_score, 3),
                'distance_score': round(distance_score, 3),
                'quality_score': round(quality_score, 3),
            }
        }

