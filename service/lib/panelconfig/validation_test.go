package panelconfig

import "testing"

func TestStyleBoundariesAndRecoverableLegacyFields(t *testing.T) {
	for _, invalid := range []map[string]interface{}{{"iconTextColor": float64(42)}, {"backgroundBlur": float64(-1)}, {"searchBoxShow": "yes"}, {"maxWidth": nil}, {"iconStyle": float64(3)}} {
		if Validate(invalid) == nil {
			t.Fatal("accepted invalid field", invalid)
		}
	}
	if err := Validate(map[string]interface{}{"searchBoxShow": false, "backgroundBlur": float64(0), "maxWidthUnit": "%", "maxWidth": float64(100)}); err != nil {
		t.Fatal(err)
	}
	clean, warnings := Sanitize(map[string]interface{}{"logoText": "Keep", "iconTextColor": float64(42)})
	if len(warnings) != 1 || clean["logoText"] != "Keep" || clean["iconTextColor"] != nil {
		t.Fatal("incorrect legacy repair")
	}
}
