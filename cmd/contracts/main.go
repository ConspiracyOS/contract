package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/ConspiracyOS/contracts/internal/builtins"
	"github.com/ConspiracyOS/contracts/internal/engine"
	"github.com/ConspiracyOS/contracts/internal/escalation"
	"github.com/ConspiracyOS/contracts/internal/project"
	"github.com/ConspiracyOS/contracts/internal/scaffold"
)

func main() {
	var exitCode int

	root := &cobra.Command{
		Use:     "contracts",
		Short:   "Evaluate programmatic contracts against a project or system",
		Version: "0.1.0",
	}

	root.AddCommand(auditCmd(&exitCode), contractCmd(&exitCode), initCmd(), installCmd())
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
	if exitCode != 0 {
		os.Exit(exitCode)
	}
}

func auditCmd(exitCode *int) *cobra.Command {
	var trigger string
	var noBuiltins, verbose, jsonOut bool

	cmd := &cobra.Command{
		Use:   "audit",
		Short: "Run all applicable contracts for the given trigger",
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, _ := os.Getwd()
			root := project.FindRoot(cwd)
			code, err := auditIn(root, trigger, noBuiltins, verbose, jsonOut)
			if err != nil {
				return err
			}
			*exitCode = code
			return nil
		},
	}

	cmd.Flags().StringVar(&trigger, "trigger", "commit", "Trigger context: commit|pr|merge|schedule")
	cmd.Flags().BoolVar(&noBuiltins, "no-builtins", false, "Skip built-in contracts")
	cmd.Flags().BoolVar(&verbose, "verbose", false, "Show per-file results")
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Output results as JSON")
	return cmd
}

func auditIn(root, trigger string, noBuiltins, verbose, jsonOut bool) (int, error) {
	cfg, err := project.LoadConfig(root)
	if err != nil {
		return 0, fmt.Errorf("loading config: %w", err)
	}

	var all []*engine.Contract
	if !noBuiltins {
		bcs, err := builtins.Load(cfg.Stack)
		if err != nil {
			return 0, fmt.Errorf("loading builtins: %w", err)
		}
		all = append(all, bcs...)
	}

	pcs, err := project.LoadProjectContracts(root)
	if err != nil {
		return 0, fmt.Errorf("loading project contracts: %w", err)
	}
	all = append(all, pcs...)

	if len(all) == 0 {
		fmt.Println("No contracts found. Create .agent/contracts/*.yaml to add project contracts.")
		return 0, nil
	}

	result := engine.RunAudit(all, engine.Trigger(trigger), root)

	if cfg.Escalation != nil && cfg.Escalation.Command != "" {
		escalation.Dispatch(cfg.Escalation.Command, result)
	}

	if jsonOut {
		fmt.Println(engine.FormatJSON(result))
	} else {
		fmt.Print(engine.FormatText(result, verbose))
	}

	if result.Failed > 0 {
		return 1, nil
	}
	return 0, nil
}

func contractCmd(exitCode *int) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "contract",
		Short: "Manage contracts",
	}
	cmd.AddCommand(contractListCmd(), contractCheckCmd(exitCode))
	return cmd
}

func contractListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List all contracts (builtins + project)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, _ := os.Getwd()
			root := project.FindRoot(cwd)
			return listContractsIn(root)
		},
	}
}

func listContractsIn(root string) error {
	cfg, err := project.LoadConfig(root)
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	bcs, err := builtins.Load(cfg.Stack)
	if err != nil {
		return fmt.Errorf("loading builtins: %w", err)
	}

	pcs, err := project.LoadProjectContracts(root)
	if err != nil {
		return fmt.Errorf("loading project contracts: %w", err)
	}

	all := append(bcs, pcs...)

	fmt.Printf("%-14s %-8s %-10s %s\n", "ID", "TRIGGER", "SOURCE", "DESCRIPTION")
	fmt.Println("─────────────────────────────────────────────────────────────")
	for _, c := range all {
		source := "project"
		if c.Builtin {
			source = "builtin"
		}
		fmt.Printf("%-14s %-8s %-10s %s\n", c.ID, c.Trigger, source, c.Description)
	}
	return nil
}

func contractCheckCmd(exitCode *int) *cobra.Command {
	var trigger string
	cmd := &cobra.Command{
		Use:   "check <id>",
		Short: "Run a single contract by ID",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, _ := os.Getwd()
			root := project.FindRoot(cwd)
			code, err := checkContractIn(root, args[0], trigger)
			if err != nil {
				return err
			}
			*exitCode = code
			return nil
		},
	}
	cmd.Flags().StringVar(&trigger, "trigger", "commit", "Trigger context: commit|pr|merge|schedule")
	return cmd
}

func checkContractIn(root, id, trigger string) (int, error) {
	cfg, err := project.LoadConfig(root)
	if err != nil {
		return 0, fmt.Errorf("loading config: %w", err)
	}

	bcs, err := builtins.Load(cfg.Stack)
	if err != nil {
		return 0, fmt.Errorf("loading builtins: %w", err)
	}

	pcs, err := project.LoadProjectContracts(root)
	if err != nil {
		return 0, fmt.Errorf("loading project contracts: %w", err)
	}

	all := append(bcs, pcs...)

	var found *engine.Contract
	for _, c := range all {
		if c.ID == id {
			found = c
			break
		}
	}
	if found == nil {
		return 0, fmt.Errorf("contract %q not found", id)
	}

	result := engine.RunAudit([]*engine.Contract{found}, engine.Trigger(trigger), root)
	fmt.Print(engine.FormatText(result, true))
	if result.Failed > 0 {
		return 1, nil
	}
	return 0, nil
}

func initCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Scaffold .agent/ directory and install git hooks",
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("getwd: %w", err)
			}
			root := project.FindRoot(cwd)
			fmt.Printf("Initializing contracts in %s\n", root)
			return scaffold.InitProject(root)
		},
	}
}

func installCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "install",
		Short: "Re-install git hooks (idempotent)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("getwd: %w", err)
			}
			root := project.FindRoot(cwd)
			return scaffold.InstallHooks(root)
		},
	}
}
