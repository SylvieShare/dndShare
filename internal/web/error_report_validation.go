package web

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

func decodeErrorReportScreenshot(dataURL *string) ([]byte, *string, error) {
	if dataURL == nil || strings.TrimSpace(*dataURL) == "" {
		return nil, nil, nil
	}
	value := strings.TrimSpace(*dataURL)
	comma := strings.IndexByte(value, ',')
	if comma < 0 {
		return nil, nil, errors.New("Некорректный формат скриншота")
	}
	header := value[:comma]
	contentType := ""
	switch header {
	case "data:image/jpeg;base64":
		contentType = "image/jpeg"
	case "data:image/png;base64":
		contentType = "image/png"
	case "data:image/webp;base64":
		contentType = "image/webp"
	default:
		return nil, nil, errors.New("Поддерживаются скриншоты JPEG, PNG и WebP")
	}
	encoded := value[comma+1:]
	if base64.StdEncoding.DecodedLen(len(encoded)) > maxErrorReportScreenshotBytes {
		return nil, nil, fmt.Errorf("Скриншот слишком большой (максимум %d МБ)", maxErrorReportScreenshotBytes>>20)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(decoded) == 0 {
		return nil, nil, errors.New("Некорректные данные скриншота")
	}
	if len(decoded) > maxErrorReportScreenshotBytes {
		return nil, nil, fmt.Errorf("Скриншот слишком большой (максимум %d МБ)", maxErrorReportScreenshotBytes>>20)
	}
	if !validScreenshotSignature(contentType, decoded) {
		return nil, nil, errors.New("Данные не соответствуют формату изображения")
	}
	return decoded, &contentType, nil
}

func validScreenshotSignature(contentType string, data []byte) bool {
	switch contentType {
	case "image/jpeg":
		return bytes.HasPrefix(data, []byte{0xff, 0xd8, 0xff})
	case "image/png":
		return bytes.HasPrefix(data, []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})
	case "image/webp":
		return len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP"
	default:
		return false
	}
}

func normalizeErrorReportMessage(message string) (string, error) {
	message = strings.TrimSpace(message)
	if message == "" || utf8.RuneCountInString(message) > maxErrorReportMessageRunes {
		return "", fmt.Errorf("Сообщение должно содержать от 1 до %d символов", maxErrorReportMessageRunes)
	}
	return message, nil
}

func normalizeErrorReportTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" || utf8.RuneCountInString(title) > maxErrorReportTitleRunes {
		return "", fmt.Errorf("Заголовок должен содержать от 1 до %d символов", maxErrorReportTitleRunes)
	}
	return title, nil
}
