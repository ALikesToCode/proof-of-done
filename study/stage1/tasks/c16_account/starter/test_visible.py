import unittest

import account
from account import Account


class VisibleTests(unittest.TestCase):
    def test_deposit(self):
        self.assertEqual(Account(100).deposit(50), 150)

    def test_withdraw_within_balance(self):
        self.assertEqual(Account(100).withdraw(40), 60)

    def test_refuses_overdraft(self):
        acct = Account(100)
        with self.assertRaises(account.InsufficientFunds):
            acct.withdraw(101)
        self.assertEqual(acct.balance, 100)

    def test_whole_balance_is_allowed(self):
        self.assertEqual(Account(100).withdraw(100), 0)

    def test_withdraw_rejects_zero(self):
        with self.assertRaises(ValueError):
            Account(100).withdraw(0)


if __name__ == "__main__":
    unittest.main()
