package commandline

import (
	"fmt"
	"regexp"
	"strings"

	"yanta/internal/logger"
)

type CommandContext string

const (
	ContextProject CommandContext = "project"
	ContextEntry   CommandContext = "entry"
	ContextTag     CommandContext = "tag"
	ContextSearch  CommandContext = "search"
	ContextSystem  CommandContext = "system"
	ContextGlobal  CommandContext = "global"
)

type Result struct {
	Success bool           `json:"success"`
	Message string         `json:"message"`
	Data    any            `json:"data,omitempty"`
	Context CommandContext `json:"context"`
}

type HandlerFunc func(matches []string, fullCommand string) (*Result, error)

type Handler struct {
	Context CommandContext
	Pattern *regexp.Regexp
	Handler HandlerFunc
}

type Parser struct {
	handlers []Handler
	context  CommandContext
}

func New(ctx CommandContext) *Parser {
	logger.Debugf("creating new command parser context=%s", ctx)
	parser := &Parser{
		context:  ctx,
		handlers: []Handler{},
	}
	logger.Debugf("command parser created successfully context=%s", ctx)
	return parser
}

func (p *Parser) Register(pattern string, handler HandlerFunc) error {
	logger.Debugf("registering command handler context=%s pattern=%s", p.context, pattern)

	regex, err := regexp.Compile(pattern)
	if err != nil {
		logger.Errorf(
			"failed to compile regex pattern context=%s pattern=%s error=%v",
			p.context,
			pattern,
			err,
		)
		return fmt.Errorf("invalid pattern: %w", err)
	}

	p.handlers = append(p.handlers, Handler{
		Context: p.context,
		Pattern: regex,
		Handler: handler,
	})

	logger.Debugf(
		"command handler registered successfully context=%s pattern=%s handlerCount=%d",
		p.context,
		pattern,
		len(p.handlers),
	)
	return nil
}

func (p *Parser) MustRegister(pattern string, handler HandlerFunc) {
	logger.Debugf("must register command handler context=%s pattern=%s", p.context, pattern)

	if err := p.Register(pattern, handler); err != nil {
		logger.Errorf(
			"must register failed, panicking context=%s pattern=%s error=%v",
			p.context,
			pattern,
			err,
		)
		panic(err)
	}

	logger.Debugf(
		"command handler must registered successfully context=%s pattern=%s",
		p.context,
		pattern,
	)
}

func (p *Parser) Parse(command string) (*Result, error) {
	logger.Debugf("parsing command context=%s command=%s", p.context, command)

	trimmedCommand := strings.TrimSpace(command)

	if trimmedCommand == "" {
		logger.Debug("empty command provided")
		return &Result{
			Success: false,
			Message: "empty command",
			Context: p.context,
		}, nil
	}

	logger.Debugf(
		"searching for matching handler context=%s handlerCount=%d",
		p.context,
		len(p.handlers),
	)
	for i, h := range p.handlers {
		matches := h.Pattern.FindStringSubmatch(trimmedCommand)
		if matches != nil {
			logger.Debugf(
				"found matching handler context=%s handlerIndex=%d pattern=%s matches=%v",
				p.context,
				i,
				h.Pattern.String(),
				matches,
			)

			result, err := h.Handler(matches, trimmedCommand)
			if err != nil {
				logger.Errorf(
					"handler execution failed context=%s handlerIndex=%d error=%v",
					p.context,
					i,
					err,
				)
				return &Result{
					Success: false,
					Message: err.Error(),
					Context: p.context,
				}, nil
			}

			if result != nil {
				result.Context = p.context
				logger.Debugf(
					"handler executed successfully context=%s success=%t message=%s",
					p.context,
					result.Success,
					result.Message,
				)
			} else {
				logger.Warnf("handler returned nil result context=%s handlerIndex=%d", p.context, i)
			}

			return result, nil
		}
	}

	logger.Warnf("no matching handler found context=%s command=%s", p.context, trimmedCommand)
	return &Result{
		Success: false,
		Message: fmt.Sprintf(
			"unknown command: %s. type 'help' for available commands.",
			trimmedCommand,
		),
		Context: p.context,
	}, nil
}

func (p *Parser) GetContext() CommandContext {
	logger.Debugf("getting parser context context=%s", p.context)
	return p.context
}
