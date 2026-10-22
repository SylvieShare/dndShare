package web

import (
	"bytes"
	"encoding/binary"
	"errors"
)

func rasterImageDimensions(data []byte, contentType string) (int, int, error) {
	switch contentType {
	case "image/png":
		if len(data) < 24 || !bytes.Equal(data[:8], []byte("\x89PNG\r\n\x1a\n")) {
			return 0, 0, errors.New("invalid PNG header")
		}
		return int(binary.BigEndian.Uint32(data[16:20])), int(binary.BigEndian.Uint32(data[20:24])), nil
	case "image/webp":
		if len(data) < 25 || !bytes.Equal(data[:4], []byte("RIFF")) || !bytes.Equal(data[8:12], []byte("WEBP")) {
			return 0, 0, errors.New("invalid WebP header")
		}
		switch string(data[12:16]) {
		case "VP8X":
			if len(data) < 30 {
				return 0, 0, errors.New("short VP8X header")
			}
			width := 1 + int(data[24]) + (int(data[25]) << 8) + (int(data[26]) << 16)
			height := 1 + int(data[27]) + (int(data[28]) << 8) + (int(data[29]) << 16)
			return width, height, nil
		case "VP8L":
			if data[20] != 0x2f {
				return 0, 0, errors.New("invalid VP8L signature")
			}
			width := 1 + int(data[21]) + (int(data[22]&0x3f) << 8)
			height := 1 + int(data[22]>>6) + (int(data[23]) << 2) + (int(data[24]&0x0f) << 10)
			return width, height, nil
		case "VP8 ":
			if len(data) < 30 || !bytes.Equal(data[23:26], []byte{0x9d, 0x01, 0x2a}) {
				return 0, 0, errors.New("invalid VP8 frame header")
			}
			width := int(binary.LittleEndian.Uint16(data[26:28]) & 0x3fff)
			height := int(binary.LittleEndian.Uint16(data[28:30]) & 0x3fff)
			return width, height, nil
		default:
			return 0, 0, errors.New("unsupported WebP encoding")
		}
	default:
		return 0, 0, errors.New("unsupported image type")
	}
}
