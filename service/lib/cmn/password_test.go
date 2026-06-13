package cmn

import "testing"

func TestPasswordEncryptionRejectsInvalidLength(t *testing.T) {
	if _, err := PasswordEncryption("short"); err == nil {
		t.Fatal("expected short password to be rejected")
	}
	if _, err := PasswordEncryption("1234567890123456789012345678901234567890123456789012345678901234567890123"); err == nil {
		t.Fatal("expected password longer than bcrypt limit to be rejected")
	}
}

func TestPasswordEncryptionAndVerifyPassword(t *testing.T) {
	hash, err := PasswordEncryption("12345678")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword("12345678", hash) {
		t.Fatal("expected password verification to pass")
	}
	if VerifyPassword("wrong-password", hash) {
		t.Fatal("expected password verification to fail")
	}
}
