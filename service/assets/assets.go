package assets

import (
	"embed"
	"fmt"
	"strings"
)

//go:embed conf.example.ini version lang/*.ini
var files embed.FS

func Asset(name string) ([]byte, error) {
	name = strings.TrimPrefix(name, "assets/")
	data, err := files.ReadFile(name)
	if err != nil {
		return nil, fmt.Errorf("asset %q: %w", name, err)
	}
	return data, nil
}
