package system

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

type boundedOutput struct {
	bytes.Buffer
	truncated bool
}

func (b *boundedOutput) Write(p []byte) (int, error) {
	n := len(p)
	remaining := 2*1024*1024 - b.Len()
	if len(p) > remaining {
		p = p[:remaining]
		b.truncated = true
	}
	_, _ = b.Buffer.Write(p)
	return n, nil
}

func dockerCmd(parent context.Context, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", args...)
	cmd.Env = append(cmd.Environ(), "LC_ALL=C")
	cmd.WaitDelay = time.Second
	output := &boundedOutput{}
	cmd.Stdout, cmd.Stderr = output, output
	err := cmd.Run()
	if ctx.Err() != nil {
		return []byte("Docker operation timed out or was cancelled; refresh to verify container state"), ctx.Err()
	}
	if output.truncated {
		return []byte("Docker output exceeds 2 MiB; request fewer log lines"), fmt.Errorf("output too large")
	}
	if err != nil && output.Len() == 0 {
		return []byte(err.Error()), err
	}
	return output.Bytes(), err
}

func (a *DockerApi) Containers(c *gin.Context) {
	out, err := dockerCmd(c.Request.Context(), "ps", "-a", "--format", "{{json .}}")
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
	out, err := dockerCmd(c.Request.Context(), "stats", "--no-stream", "--format", "{{json .}}")
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
	out, err := dockerCmd(c.Request.Context(), args...)
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

	out, err := dockerCmd(c.Request.Context(), "logs", "--tail", strconv.Itoa(req.Lines), "--timestamps", req.ID)
	if err != nil {
		apiReturn.Error(c, strings.TrimSpace(string(out)))
		return
	}
	apiReturn.SuccessData(c, gin.H{
		"logs":        string(out),
		"generatedAt": time.Now(),
	})
}
