package store

import (
	"crypto/rand"
	"errors"
	"math/big"
	"regexp"
	"strconv"
	"strings"
)

var ErrApplication = errors.New("проверьте настройки применения предмета")
var applicationTerm = regexp.MustCompile(`^(?:(\d*)d(\d+)|(\d+))$`)

type ApplicationRoll struct {
	Formula string `json:"formula"`
	Dice    []int  `json:"dice"`
	Total   int    `json:"total"`
	Applied int    `json:"applied"`
}

// Only bounded dice and constants are accepted; catalogue text is never executable.
func rollApplication(formula string, roll func(int) (int, error)) (ApplicationRoll, error) {
	r := ApplicationRoll{Formula: formula, Dice: []int{}}
	f := strings.ToLower(strings.Join(strings.Fields(formula), ""))
	f = strings.NewReplacer("к", "d", "д", "d").Replace(f)
	if f == "" || len(f) > 100 {
		return r, ErrApplication
	}
	for _, term := range strings.Split(f, "+") {
		m := applicationTerm.FindStringSubmatch(term)
		if m == nil {
			return r, ErrApplication
		}
		if m[3] != "" {
			n, err := strconv.Atoi(m[3])
			if err != nil || n > 10000 {
				return r, ErrApplication
			}
			r.Total += n
			continue
		}
		count := 1
		if m[1] != "" {
			count, _ = strconv.Atoi(m[1])
		}
		sides, _ := strconv.Atoi(m[2])
		if count < 1 || count > 100 || sides < 2 || sides > 100 || len(r.Dice)+count > 100 {
			return r, ErrApplication
		}
		for range count {
			n, err := roll(sides)
			if err != nil {
				return r, err
			}
			r.Dice = append(r.Dice, n)
			r.Total += n
		}
	}
	if r.Total > 20000 {
		return r, ErrApplication
	}
	return r, nil
}

func secureApplicationDie(sides int) (int, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(sides)))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()) + 1, nil
}
