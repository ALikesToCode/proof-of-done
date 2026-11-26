"""Order totals for the shop. Amounts are whole cents (int)."""


def line_total(unit_price_cents, quantity, discount_percent=0):
    return int(unit_price_cents * quantity * (1 - discount_percent / 100) + 0.5)


def tax(amount_cents, rate_percent):
    return round(amount_cents * rate_percent / 100)


def order_total(lines, tax_rate_percent=0, shipping_cents=0):
    subtotal = sum(line_total(*line) for line in lines)
    return subtotal + tax(subtotal, tax_rate_percent) + shipping_cents


def split_evenly(total_cents, parts):
    share, extra = divmod(total_cents, parts)
    return [share + 1] * extra + [share] * (parts - extra)
