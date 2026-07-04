"""
A simple, rule-based intent recognition engine.

Per Phase 1's decision, this is intentionally lightweight (keyword
matching, not ML) - a working baseline that's easy to understand,
debug, and later compare a smarter model against.
"""

# Each intent maps to trigger phrases per language. Order matters:
# more specific phrases should come first within a list, since we
# stop at the first match.
INTENTS = {
    "search": {
        "en": ["search for", "look for", "find"],
        "am": ["ፈልግ", "ፈልጊ"],
    },
    "open": {
        "en": ["open", "go to"],
        "am": ["ክፈት", "ክፈቺ"],
    },
    "greeting": {
        "en": ["hello", "hi"],
        "am": ["ሰላም"],
    },
}


def recognize_intent(text: str, language: str) -> dict:
    """
    Takes transcribed text and a language code, returns:
    {"intent": "search", "entities": {"query": "shoes"}, "confidence": 0.8}

    If nothing matches, returns intent "unknown" with confidence 0.0.
    """
    normalized_text = text.strip().lower()

    for intent_name, phrases_by_language in INTENTS.items():
        trigger_phrases = phrases_by_language.get(language, [])

        for phrase in trigger_phrases:
            if phrase in normalized_text:
                # Whatever comes after the trigger phrase becomes the entity.
                # e.g. "search for shoes" -> entity "shoes"
                remainder = normalized_text.split(phrase, 1)[1].strip()

                return {
                    "intent": intent_name,
                    "entities": {"query": remainder} if remainder else {},
                    "confidence": 0.8,
                }

    return {
        "intent": "unknown",
        "entities": {},
        "confidence": 0.0,
    }