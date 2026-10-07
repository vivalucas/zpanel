package models

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

const MaxNavigationTitleRunes = 200

func ValidateNavigationTitle(title string) error {
	if strings.TrimSpace(title) == "" || utf8.RuneCountInString(title) > MaxNavigationTitleRunes {
		return fmt.Errorf("title must contain 1–%d characters", MaxNavigationTitleRunes)
	}
	return nil
}
