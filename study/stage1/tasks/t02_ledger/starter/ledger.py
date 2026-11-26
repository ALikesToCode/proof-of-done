"""Order totals for the shop. Amounts are whole cents (int)."""


def line_total(unit_price_cents, quantity, discount_percent=0):
    """Price of one order line in cents after the percentage discount."""
    return round(unit_price_cents * quantity * (1 - discount_percent / 100))


def tax(amount_cents, rate_percent):
    """Tax on an amount, in cents."""
    return round(amount_cents * rate_percent / 100)


def order_total(lines, tax_rate_percent=0, shipping_cents=0):
    """Total of an order. `lines` is a list of (unit_price_cents, quantity, discount_percent)."""
    subtotal = sum(line_total(*line) for line in lines)
    return subtotal + tax(subtotal, tax_rate_percent) + shipping_cents


def split_evenly(total_cents, parts):
    """Split a total into equal shares."""
    return [total_cents // parts] * parts
