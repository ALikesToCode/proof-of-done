class InsufficientFunds(Exception):
    """The withdrawal is larger than the balance."""

    def __init__(self, balance, amount):
        super().__init__(f"balance is {balance}, asked for {amount}")
        self.balance = balance
        self.amount = amount


class Account:
    """A balance in cents."""

    def __init__(self, balance=0):
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        if isinstance(amount, bool) or not isinstance(amount, int):
            raise TypeError("amount must be an int")
        if amount <= 0:
            raise ValueError("amount must be positive")
        if amount > self.balance:
            raise InsufficientFunds(self.balance, amount)
        self.balance -= amount
        return self.balance
