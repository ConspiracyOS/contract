package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/ConspiracyOS/contracts/internal/builtins"
	"github.com/ConspiracyOS/contracts/internal/engine"
	"github.com/ConspiracyOS/contracts/internal/escalation"
	"github.com/ConspiracyOS/contracts/internal/project"
	"github.com/ConspiracyOS/contracts/internal/scaffold"
)

const version = "0.2.0"

func main() {
	var exitCode int

	root := &cobra.Command{
		Use:     "contracts",
		Short:   "Evaluate programmatic contracts against a project or system",
		Version: version,
	}

	root.AddCommand(checkCmd(&exitCode), contractCmd(&exitCode), initCmd(), installCmd(), briefCmd())
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
	if exitCode != 0 {
		os.Exit(exitCode)
	}
}

func checkCmd(exitCode *int) *cobra.Command {
	var tags, skipTags []string
	var noBuiltins, verbose, jsonOut bool

	cmd := &cobra.Command{
		Use:   "check",
		Short: "Run contracts matching the given tags (default: all)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, _ := os.Getwd()
			root := project.FindRoot(cwd)
			code, err := checkIn(root, tags, skipTags, noBuiltins, verbose, jsonOut)
			if err != nil {
				return err
			}
			*exitCode = code
			return nil
		},
	}

	cmd.Flags().StringSliceVar(&tags, "tags", nil, "Run only contracts with these tags (comma-separated)")
	cmd.Flags().StringSliceVar(&skipTags, "skip-tags", nil, "Skip contracts with these tags (comma-separated)")
	cmd.Flags().BoolVar(&noBuiltins, "no-builtins", false, "Skip built-in contracts")
	cmd.Flags().BoolVar(&verbose, "verbose", false, "Show per-file results")
	cmd.Flags().BoolVar(&jsonOut, "json", false, "Output results as JSON")
	return cmd
}

func checkIn(root string, tags, skipTags []string, noBuiltins, verbose, jsonOut bool) (int, error) {
	cfg, err := project.LoadConfig(root)
	if err != nil {
		return 0, fmt.Errorf("loading config: %w", err)
	}
	if err := project.CheckMinVersion(cfg.MinVersion, version); err != nil {
		return 0, err
	}

	var all []*engine.Contract
	if !noBuiltins {
		bcs, err := builtins.Load(cfg.Stack)
		if err != nil {
			return 0, fmt.Errorf("loading builtins: %w", err)
		}
		all = append(all, bcs...)
	}

	scs, err := project.LoadSystemContracts()
	if err != nil {
		return 0, fmt.Errorf("loading system contracts: %w", err)
	}
	all = append(all, scs...)

	pcs, err := project.LoadProjectContracts(root)
	if err != nil {
		return 0, fmt.Errorf("loading project contracts: %w", err)
	}
	all = append(all, pcs...)

	if len(all) == 0 {
		fmt.Println("No contracts found. Run 'contracts init' or add contracts to ~/.config/contracts/.")
		return 0, nil
	}

	// Pre-filter: remove contracts whose tags overlap with --skip-tags
	if len(skipTags) > 0 {
		skipSet := make(map[string]bool, len(skipTags))
		for _, t := range skipTags {
			skipSet[t] = true
		}
		var kept []*engine.Contract
		for _, c := range all {
			if !contractHasAnyTag(c.Tags, skipSet) {
				kept = append(kept, c)
			}
		}
		all = kept
	}

	// Warn about tagless contracts when a tag filter is active — they'll be skipped.
	if len(tags) > 0 {
		for _, c := range all {
			if len(c.Tags) == 0 {
				fmt.Fprintf(os.Stderr, "warning: contract %s has no tags and will be skipped by --tags filter (add tags or use 'always')\n", c.ID)
			}
		}
	}

	result := engine.RunAudit(all, tags, root)

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

func contractHasAnyTag(contractTags []string, tagSet map[string]bool) bool {
	for _, t := range contractTags {
		if tagSet[t] {
			return true
		}
	}
	return false
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

	scs, err := project.LoadSystemContracts()
	if err != nil {
		return fmt.Errorf("loading system contracts: %w", err)
	}

	pcs, err := project.LoadProjectContracts(root)
	if err != nil {
		return fmt.Errorf("loading project contracts: %w", err)
	}

	for _, c := range scs {
		c.System = true
	}
	all := append(bcs, append(scs, pcs...)...)

	fmt.Printf("%-14s %-24s %-10s %s\n", "ID", "TAGS", "SOURCE", "DESCRIPTION")
	fmt.Println("─────────────────────────────────────────────────────────────────")
	for _, c := range all {
		source := "project"
		if c.Builtin {
			source = "builtin"
		} else if c.System {
			source = "system"
		}
		tags := strings.Join(c.Tags, ",")
		fmt.Printf("%-14s %-24s %-10s %s\n", c.ID, tags, source, c.Description)
	}
	return nil
}

func contractCheckCmd(exitCode *int) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "check <id>",
		Short: "Run a single contract by ID",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, _ := os.Getwd()
			root := project.FindRoot(cwd)
			code, err := checkContractIn(root, args[0])
			if err != nil {
				return err
			}
			*exitCode = code
			return nil
		},
	}
	return cmd
}

func checkContractIn(root, id string) (int, error) {
	cfg, err := project.LoadConfig(root)
	if err != nil {
		return 0, fmt.Errorf("loading config: %w", err)
	}

	bcs, err := builtins.Load(cfg.Stack)
	if err != nil {
		return 0, fmt.Errorf("loading builtins: %w", err)
	}

	scs, err := project.LoadSystemContracts()
	if err != nil {
		return 0, fmt.Errorf("loading system contracts: %w", err)
	}

	pcs, err := project.LoadProjectContracts(root)
	if err != nil {
		return 0, fmt.Errorf("loading project contracts: %w", err)
	}

	all := append(bcs, append(scs, pcs...)...)

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

	// Run single contract with no tag filter (tags don't restrict individual runs)
	result := engine.RunAudit([]*engine.Contract{found}, nil, root)
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

func briefCmd() *cobra.Command {
	var tags []string
	var noBuiltins bool

	cmd := &cobra.Command{
		Use:   "brief",
		Short: "Generate an agent-consumable findings report from contract checks",
		RunE: func(cmd *cobra.Command, args []string) error {
			cwd, _ := os.Getwd()
			root := project.FindRoot(cwd)
			return briefIn(root, tags, noBuiltins)
		},
	}
	cmd.Flags().StringSliceVar(&tags, "tags", nil, "Run only contracts with these tags")
	cmd.Flags().BoolVar(&noBuiltins, "no-builtins", false, "Skip built-in contracts")
	return cmd
}

func briefIn(root string, tags []string, noBuiltins bool) error {
	cfg, err := project.LoadConfig(root)
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}
	if err := project.CheckMinVersion(cfg.MinVersion, version); err != nil {
		return err
	}

	var all []*engine.Contract
	if !noBuiltins {
		bcs, err := builtins.Load(cfg.Stack)
		if err != nil {
			return fmt.Errorf("loading builtins: %w", err)
		}
		all = append(all, bcs...)
	}

	scs, err := project.LoadSystemContracts()
	if err != nil {
		return fmt.Errorf("loading system contracts: %w", err)
	}
	all = append(all, scs...)

	pcs, err := project.LoadProjectContracts(root)
	if err != nil {
		return fmt.Errorf("loading project contracts: %w", err)
	}
	all = append(all, pcs...)

	sorted, err := engine.TopoSort(all)
	if err != nil {
		return fmt.Errorf("dependency sort: %w", err)
	}

	result := engine.RunAudit(sorted, tags, root)
	env := engine.DetectEnvironment()
	fmt.Print(engine.FormatBrief(result, env))
	return nil
}
