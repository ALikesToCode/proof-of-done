"""Order totals for the shop. Amounts are whole cents (int)."""
from decimal import ROUND_HALF_UP, Decimal


def _decimal(value):
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _cents(amount):
    return int(amount.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def line_total(unit_price_cents, quantity, discount_percent=0):
    """Price of one order line in cents after the percentage discount."""
    gross = _decimal(unit_price_cents) * _decimal(quantity)
    return _cents(gross * (Decimal(100) - _decimal(discount_percent)) / Decimal(100))


def tax(amount_cents, rate_percent):
    """Tax on an amount, in cents."""
    return _cents(_decimal(amount_cents) * _decimal(rate_percent) / Decimal(100))


def order_total(lines, tax_rate_percent=0, shipping_cents=0):
    """Total of an order. `lines` is a list of (unit_price_cents, quantity, discount_percent)."""
    subtotal = sum(line_total(*line) for line in lines)
    return subtotal + tax(subtotal, tax_rate_percent) + shipping_cents


def split_evenly(total_cents, parts):
    """Split a total into shares that add up to it, larger shares first."""
    if parts < 1:
        raise ValueError("parts must be at least 1")
    share, extra = divmod(total_cents, parts)
    return [share + 1] * extra + [share] * (parts - extra)
