package document

import (
	"errors"
	"fmt"
)

var (
	ErrNotFound    = errors.New("document not found")
	ErrInvalidPath = errors.New("invalid document path")
	ErrValidation  = errors.New("document validation failed")
	ErrCorrupted   = errors.New("document file corrupted")
	ErrWriteFailed = errors.New("failed to write document")
)

type IOError struct {
	Op   string
	Path string
	Err  error
}

func (e *IOError) Error() string {
	return fmt.Sprintf("%s %s: %v", e.Op, e.Path, e.Err)
}

func (e *IOError) Unwrap() error {
	return e.Err
}

func wrapIOError(op, path string, err error) error {
	if err == nil {
		return nil
	}
	return &IOError{Op: op, Path: path, Err: err}
}
