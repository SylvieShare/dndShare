package storage

import (
	"context"
	"errors"
	"regexp"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

var creatureArchiveKey = regexp.MustCompile(`^creature-model-archives/[1-9][0-9]*/[0-9a-f-]{36}/(native|ready)/[0-9a-f]{64}\.tar\.gz$`)
var creatureArchiveUpload = regexp.MustCompile(`^creature-model-archive-uploads/[0-9a-f-]{36}\.tar\.gz$`)
var creatureArchivePrefix = regexp.MustCompile(`^creature-model-archives/[1-9][0-9]*/$`)

type CreatureArchiveObject struct {
	Key        string     `json:"key"`
	Size       int64      `json:"size"`
	ModifiedAt *time.Time `json:"modifiedAt"`
}

func (s *Service) PresignCreatureArchiveUpload(ctx context.Context, size int64) (string, string, error) {
	id, err := newUUID()
	if err != nil {
		return "", "", err
	}
	key := "creature-model-archive-uploads/" + id + ".tar.gz"
	request, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.cfg.Bucket), Key: aws.String(key), ContentType: aws.String("application/gzip"), ContentLength: aws.Int64(size)}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", "", err
	}
	return key, request.URL, nil
}

func (s *Service) PromoteCreatureArchive(ctx context.Context, source, target string) error {
	if !creatureArchiveUpload.MatchString(source) || !creatureArchiveKey.MatchString(target) {
		return errors.New("invalid creature archive key")
	}
	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{Bucket: aws.String(s.cfg.Bucket), Key: aws.String(target), CopySource: aws.String(s.cfg.Bucket + "/" + source), ContentType: aws.String("application/gzip"), MetadataDirective: types.MetadataDirectiveReplace})
	return err
}

func (s *Service) ListCreatureArchives(ctx context.Context, prefix, cursor string) ([]CreatureArchiveObject, string, error) {
	if !creatureArchivePrefix.MatchString(prefix) {
		return nil, "", errors.New("invalid creature archive prefix")
	}
	input := &s3.ListObjectsV2Input{Bucket: aws.String(s.cfg.Bucket), Prefix: aws.String(prefix), MaxKeys: aws.Int32(100)}
	if cursor != "" {
		input.ContinuationToken = aws.String(cursor)
	}
	result, err := s.client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, "", err
	}
	objects := []CreatureArchiveObject{}
	for _, object := range result.Contents {
		if creatureArchiveKey.MatchString(aws.ToString(object.Key)) {
			objects = append(objects, CreatureArchiveObject{Key: aws.ToString(object.Key), Size: aws.ToInt64(object.Size), ModifiedAt: object.LastModified})
		}
	}
	return objects, aws.ToString(result.NextContinuationToken), nil
}
