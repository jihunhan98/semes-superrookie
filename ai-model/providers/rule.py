from .base import Provider, ProviderError
class RuleProvider(Provider):
    name = "rule"
    enabled = False
    def generate(self, system: str, user: str) -> str:
        raise ProviderError("RULE_ONLY", False, "rule provider does not make model calls")
