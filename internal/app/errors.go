package app

import "fmt"

type AppError struct {
	Code string // e.g., "validation", "not_found", "db"
	Err  error
}

func (e *AppError) Error() string {
	if e.Err == nil {
		return e.Code
	}
	return fmt.Sprintf("%s: %v", e.Code, e.Err)
}

func Wrap(code string, err error) *AppError {
	if err == nil {
		return nil
	}
	return &AppError{Code: code, Err: err}
}
