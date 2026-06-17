package siteFavicon

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"zpanel/lib/safehttp"

	"github.com/PuerkitoBio/goquery"
)

func IsHTTPURL(url string) bool {
	httpPattern := `^(http://|https://|//)`
	match, err := regexp.MatchString(httpPattern, url)
	if err != nil {
		return false
	}
	return match
}

func GetOneFaviconURL(urlStr string) (string, error) {
	iconURLs, err := GetFaviconURLs(urlStr)
	if err != nil {
		return "", err
	}

	for _, v := range iconURLs {
		return v, nil
	}
	return "", fmt.Errorf("not found ico")
}

func GetFaviconURLs(urlStr string) ([]string, error) {
	iconURLs, err := getFaviconURL(urlStr)
	if err != nil {
		return nil, err
	}

	urlInfo, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}

	fullURLs := make([]string, 0, len(iconURLs))
	for _, v := range iconURLs {
		if IsHTTPURL(v) {
			fullURLs = append(fullURLs, v)
			continue
		}
		fullURLs = append(fullURLs, urlInfo.Scheme+"://"+urlInfo.Host+"/"+strings.TrimPrefix(v, "/"))
	}
	return fullURLs, nil
}

func GetOneFaviconURLAndUpload(urlStr string) (string, bool) {
	//www.iqiyipic.com/pcwimg/128-128-logo.png
	iconURLs, err := GetFaviconURLs(urlStr)
	if err != nil {
		return "", false
	}

	for _, v := range iconURLs {
		return v, true
	}
	return "", false
}

func getFaviconURL(url string) ([]string, error) {
	var icons []string
	icons = make([]string, 0)
	if err := safehttp.ValidateURL(url); err != nil {
		return icons, err
	}
	client := safehttp.NewClient(15 * time.Second)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return icons, err
	}

	// 设置User-Agent头字段，模拟浏览器请求
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3")

	resp, err := client.Do(req)
	if err != nil {
		return icons, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return icons, errors.New("HTTP request failed with status code " + strconv.Itoa(resp.StatusCode))
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return icons, err
	}

	// 查找所有link标签，筛选包含rel属性为"icon"的标签
	doc.Find("link").Each(func(i int, s *goquery.Selection) {
		rel, _ := s.Attr("rel")
		href, _ := s.Attr("href")

		if strings.Contains(rel, "icon") && href != "" {
			// fmt.Println(href)
			icons = append(icons, href)
		}
	})

	if len(icons) == 0 {
		return icons, errors.New("favicon not found on the page")
	}

	return icons, nil
}
