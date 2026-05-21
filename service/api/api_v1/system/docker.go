package system

import (
	"encoding/json"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
	"zpanel/api/api_v1/common/apiReturn"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

var containerIDRegexp = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$`)

type DockerApi struct{}

type dockerContainer struct {
	ID      string `json:"id"`
	Image   string `json:"image"`
	Command string `json:"command"`
	Created string `json:"created"`
	Status  string `json:"status"`
	Ports   string `json:"ports"`
	Names   string `json:"names"`
	State   string `json:"state"`
}

func dockerCmd(args ...string) ([]byte, error) {
	cmd := exec.Command("docker", args...)
	cmd.Env = append(cmd.Environ(), "LC_ALL=C")
	return cmd.CombinedOutput()
}

func (a *DockerApi) Containers(c *gin.Context) {
	out, err := dockerCmd("ps", "-a", "--format", "{{json .}}")
	if err != nil {
		apiReturn.Error(c, strings.TrimSpace(string(out)))
		return
	}

	containers := []dockerContainer{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		item := dockerContainer{}
		if err := json.Unmarshal([]byte(line), &item); err != nil {
			apiReturn.Error(c, err.Error())
			return
		}
		containers = append(containers, item)
	}
	apiReturn.SuccessListData(c, containers, int64(len(containers)))
}

func (a *DockerApi) Stats(c *gin.Context) {
	out, err := dockerCmd("stats", "--no-stream", "--format", "{{json .}}")
	if err != nil {
		apiReturn.Error(c, strings.TrimSpace(string(out)))
		return
	}

	stats := []map[string]interface{}{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		item := map[string]interface{}{}
		if err := json.Unmarshal([]byte(line), &item); err != nil {
			apiReturn.Error(c, err.Error())
			return
		}
		stats = append(stats, item)
	}
	apiReturn.SuccessData(c, stats)
}

func (a *DockerApi) Action(c *gin.Context) {
	req := struct {
		ID     string `json:"id" binding:"required"`
		Action string `json:"action" binding:"required"`
	}{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	allowed := map[string]bool{"start": true, "stop": true, "restart": true, "pause": true, "unpause": true}
	if !allowed[req.Action] {
		apiReturn.ErrorParamFomat(c, "unsupported docker action")
		return
	}

	if !containerIDRegexp.MatchString(req.ID) {
		apiReturn.ErrorParamFomat(c, "invalid container id")
		return
	}

	args := []string{req.Action, req.ID}
	if req.Action == "stop" {
		args = []string{"stop", "--time", "10", req.ID}
	}
	out, err := dockerCmd(args...)
	if err != nil {
		apiReturn.Error(c, strings.TrimSpace(string(out)))
		return
	}
	apiReturn.SuccessData(c, strings.TrimSpace(string(out)))
}

func (a *DockerApi) Logs(c *gin.Context) {
	req := struct {
		ID    string `json:"id" binding:"required"`
		Lines int    `json:"lines"`
	}{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	if req.Lines <= 0 || req.Lines > 1000 {
		req.Lines = 200
	}

	if !containerIDRegexp.MatchString(req.ID) {
		apiReturn.ErrorParamFomat(c, "invalid container id")
		return
	}

	out, err := dockerCmd("logs", "--tail", strconv.Itoa(req.Lines), "--timestamps", req.ID)
	if err != nil {
		apiReturn.Error(c, strings.TrimSpace(string(out)))
		return
	}
	apiReturn.SuccessData(c, gin.H{
		"logs":        string(out),
		"generatedAt": time.Now(),
	})
}
