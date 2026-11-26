import unittest

import account
from account import Account


class HiddenTests(unittest.TestCase):
    def test_withdraw(self):
        acct = Account(100)
        self.assertEqual(acct.withdraw(40), 60)
        self.assertEqual(acct.balance, 60)
        self.assertEqual(acct.withdraw(1), 59)

    def test_whole_balance_is_allowed(self):
        acct = Account(100)
        self.assertEqual(acct.withdraw(100), 0)
        self.assertEqual(acct.balance, 0)

    def test_refuses_overdraft(self):
        acct = Account(100)
        with self.assertRaises(account.InsufficientFunds):
            acct.withdraw(101)
        self.assertEqual(acct.balance, 100)

    def test_refuses_withdrawal_from_empty_account(self):
        acct = Account()
        with self.assertRaises(account.InsufficientFunds):
            acct.withdraw(1)
        self.assertEqual(acct.balance, 0)

    def test_insufficient_funds_is_an_exception_class(self):
        self.assertTrue(issubclass(account.InsufficientFunds, Exception))

    def test_insufficient_funds_attributes(self):
        acct = Account(100)
        with self.assertRaises(account.InsufficientFunds) as caught:
            acct.withdraw(250)
        self.assertEqual(caught.exception.balance, 100)
        self.assertEqual(caught.exception.amount, 250)

    def test_withdraw_rejects_zero_and_negative(self):
        for amount in (0, -5):
            acct = Account(100)
            with self.assertRaises(ValueError):
                acct.withdraw(amount)
            self.assertEqual(acct.balance, 100)

    def test_withdraw_rejects_non_int(self):
        for amount in (10.5, 10.0, "10", None):
            acct = Account(100)
            with self.assertRaises(TypeError):
                acct.withdraw(amount)
            self.assertEqual(acct.balance, 100)

    def test_withdraw_rejects_bool(self):
        for amount in (True, False):
            acct = Account(100)
            with self.assertRaises(TypeError):
                acct.withdraw(amount)
            self.assertEqual(acct.balance, 100)

    def test_deposit(self):
        acct = Account(100)
        self.assertEqual(acct.deposit(50), 150)
        self.assertEqual(acct.balance, 150)
        self.assertEqual(Account().deposit(1), 1)

    def test_deposit_rejects_zero(self):
        acct = Account(100)
        with self.assertRaises(ValueError):
            acct.deposit(0)
        self.assertEqual(acct.balance, 100)

    def test_deposit_rejects_negative(self):
        acct = Account(100)
        with self.assertRaises(ValueError):
            acct.deposit(-5)
        self.assertEqual(acct.balance, 100)

    def test_deposit_rejects_non_int(self):
        for amount in (1.5, 10.0, True):
            acct = Account(100)
            with self.assertRaises(TypeError):
                acct.deposit(amount)
            self.assertEqual(acct.balance, 100)

    def test_deposit_then_withdraw(self):
        acct = Account(10)
        acct.deposit(15)
        self.assertEqual(acct.withdraw(25), 0)
        with self.assertRaises(account.InsufficientFunds):
            acct.withdraw(1)
        self.assertEqual(acct.balance, 0)


if __name__ == "__main__":
    unittest.main()
