"""Independent-repository review contract, plus shared lifecycle guard scenarios."""
import json
import os
import sys
from pathlib import Path
import shutil
import unittest

import test_pre_pr_review as legacy_contract
from pre_pr_review_fixture import ReviewFixture


class IndependentReviewTest(unittest.TestCase):
    def setUp(self):
        self.fx = ReviewFixture()
        self.addCleanup(self.fx.close)

    fx_script = staticmethod(legacy_contract.PrePrReviewTest.fx_script)
    assert_preserved = legacy_contract.PrePrReviewTest.assert_preserved
    assert_refused_without_move = legacy_contract.PrePrReviewTest.assert_refused_without_move

    def test_independent_metadata_and_authoritative_head_import(self):
        original_config = (self.fx.common / 'config').read_bytes()
        record = self.fx.start()
        for role in ('baseline', 'review'):
            path = self.fx.tree(record, role)
            self.assertTrue((path / '.git').is_dir())
            self.assertFalse((path / '.git/objects/info/alternates').exists())
            self.assertNotIn('extensions.', self.fx.git('config', '--local', '--list', root=path))
            self.assertNotIn(str(path), self.fx.worktrees())
        reviewed = self.fx.commit_fix(record)
        self.assertEqual(self.fx.git('rev-parse', record['review_ref']).strip(), record['finished'])
        self.fx.cli('status', record['id'], '--json')
        self.assertEqual(self.fx.git('rev-parse', record['review_ref']).strip(), record['finished'])
        evidence, _ = self.fx.evidence(record, reviewed)
        self.fx.adopt(record, evidence)
        self.assertEqual(self.fx.git('rev-parse', record['review_ref']).strip(), reviewed)
        self.assertEqual((self.fx.common / 'config').read_bytes(), original_config)
        self.assertEqual(self.fx.git('status', '--porcelain'), '')

    def test_status_after_fix_is_read_only_and_reports_live_head(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        def metadata():
            return {str(p.relative_to(self.fx.common)): p.read_bytes()
                    for p in self.fx.common.rglob('*') if p.is_file()}
        before = metadata()
        status = json.loads(self.fx.cli('status', record['id'], '--json').stdout)
        self.assertEqual(status['records'][0]['observed']['review']['head'], reviewed)
        self.assertTrue(status['records'][0]['observed']['review']['available'])
        self.fx.cli('url', record['id'], '--json')
        self.assertEqual(metadata(), before)

    def test_checked_out_retained_review_branch_blocks_import_without_side_effects(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record, reviewed)
        other = self.fx.parent / 'foreign checkout'
        self.fx.git('worktree', 'add', str(other), record['review_ref'].removeprefix('refs/heads/'))
        before = self.fx.git('status', '--porcelain', root=other)
        result = self.fx.cli('adopt', record['id'], '--verification', str(path), '--json', ok=False)
        self.assertIn('checked out elsewhere', result.stdout)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=other).strip(), record['finished'])
        self.assertEqual(self.fx.git('status', '--porcelain', root=other), before)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), record['finished'])

    @unittest.skipIf(os.name == 'nt', 'POSIX signal fault')
    def test_interrupted_review_ref_import_recovers_adoption(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        path, _ = self.fx.evidence(record, reviewed)
        env, marker = self.fx.interruption_env(['update-ref', record['review_ref']])
        result = self.fx.command([sys.executable, self.fx_script(), 'adopt', record['id'],
                                  '--verification', str(path), '--json'], env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), result.stdout + result.stderr)
        saved = self.fx.record(record['id'])
        self.assertEqual(saved['review_import'], {'from': record['finished'], 'to': reviewed})
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), record['finished'])
        self.fx.cli('resume', record['id'], '--json')
        saved = self.fx.record(record['id'])
        self.assertEqual(saved['phase'], 'completed')
        self.assertIsNone(saved['review_import'])
        self.assertEqual(saved['retained_review'], reviewed)
        self.assertFalse(self.fx.tree(record).exists())

    @unittest.skipIf(os.name == 'nt', 'POSIX signal fault')
    def test_interrupted_review_ref_import_recovers_before_supersession(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        self.fx.write('docs/task.md', 'new finished task after review\n')
        self.fx.git('add', '--', 'docs/task.md')
        self.fx.git('commit', '-m', 'new finished work')
        env, marker = self.fx.interruption_env(['update-ref', record['review_ref']])
        result = self.fx.command([sys.executable, self.fx_script(), 'start', '--description',
                                  'successor', '--scope', 'docs', '--json'], env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), result.stdout + result.stderr)
        self.fx.cli('resume', record['id'], '--json')
        self.assertEqual(self.fx.record(record['id'])['retained_review'], reviewed)
        successor = self.fx.start(description='successor')
        self.assertNotEqual(successor['id'], record['id'])
        self.assertEqual(self.fx.record(record['id'])['phase'], 'superseded')

    def test_completed_clone_advance_retains_new_work_without_moving_accepted_ref(self):
        record = self.fx.start()
        reviewed = self.fx.commit_fix(record)
        evidence, _ = self.fx.evidence(record, reviewed)
        self.fx.completed_with_retained_worktrees(record, evidence)
        advanced = self.fx.commit_fix(record, 'later independent work\n')
        self.fx.cli('cleanup', record['id'], '--json')
        self.assertTrue(self.fx.tree(record).exists())
        self.assertEqual(self.fx.git('rev-parse', record['review_ref']).strip(), reviewed)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=self.fx.tree(record)).strip(), advanced)
        # Only an actual retained-ref move invalidates the accepted original.
        self.fx.git('update-ref', record['review_ref'], record['finished'], reviewed)
        self.fx.cli('url', record['id'], '--version', 'original', '--json', ok=False)
        self.assertEqual(self.fx.git('rev-parse', 'HEAD').strip(), reviewed)

    def test_nested_review_start_is_refused(self):
        record = self.fx.start()
        result = self.fx.cli('start', '--description', 'nested', '--scope', 'docs', '--json',
                             root=self.fx.tree(record), ok=False)
        self.assertIn('original checkout', result.stdout)

    def test_missing_independent_repository_never_recreates_unexported_commits(self):
        record = self.fx.start()
        self.fx.commit_fix(record)
        shutil.rmtree(self.fx.tree(record))
        result = self.fx.cli('resume', record['id'], '--json', ok=False)
        self.assertIn('disappeared', result.stdout)
        self.assertFalse(self.fx.tree(record).exists())

    def test_foreign_marker_shared_objects_and_extra_refs_preserved(self):
        for damage in ('marker', 'alternates', 'extra-ref'):
            with self.subTest(damage=damage):
                fx = ReviewFixture()
                self.addCleanup(fx.close)
                record = fx.start()
                fx.completed_with_retained_worktrees(record)
                tree = fx.tree(record)
                if damage == 'marker':
                    marker = tree / '.git/moneybuddy-managed.json'
                    payload = json.loads(marker.read_text())
                    payload['owner']['token'] = 'unrelated-owner'
                    marker.write_text(json.dumps(payload))
                elif damage == 'alternates':
                    (tree / '.git/objects/info/alternates').write_text(str(fx.common / 'objects') + '\n')
                else:
                    fx.git('branch', 'work/unrelated', root=tree)
                fx.cli('cleanup', record['id'], '--json')
                self.assertTrue(tree.exists())
                self.assertEqual(fx.git('rev-parse', 'HEAD').strip(), record['finished'])

    def test_external_detached_worktree_and_unique_commit_survive_cleanup(self):
        record = self.fx.start()
        self.fx.completed_with_retained_worktrees(record)
        tree = self.fx.tree(record)
        other = self.fx.parent / 'external detached work'
        self.fx.git('worktree', 'add', '--detach', str(other), 'HEAD', root=tree)
        self.fx.write('docs/task.md', 'unique external work must survive\n', root=other)
        self.fx.git('add', '--', 'docs/task.md', root=other)
        self.fx.git('commit', '-m', 'unique detached commit', root=other)
        unique = self.fx.git('rev-parse', 'HEAD', root=other).strip()
        self.fx.cli('cleanup', record['id'], '--json')
        self.assertTrue(tree.exists())
        self.assertEqual(self.fx.git('rev-parse', 'HEAD', root=other).strip(), unique)
        self.assertEqual(self.fx.git('show', unique + ':docs/task.md', root=other),
                         'unique external work must survive\n')

    def test_partial_creation_without_ownership_marker_is_not_taken_over(self):
        record = self.fx.start()
        marker = self.fx.tree(record) / '.git/moneybuddy-managed.json'
        marker.unlink()
        result = self.fx.cli('resume', record['id'], '--json', ok=False)
        self.assertIn('ownership marker missing', result.stdout)
        self.assertTrue(self.fx.tree(record).exists())


# Run the same evidence, branch, dirty-content and interruption contract against
# independent storage. Linked-worktree-only recovery tests remain in the legacy suite.
_SHARED = '''
checkpoint_exact_selection_preserves_other_index_and_worktree_bytes
literal_special_filenames_are_committed_without_wildcard_expansion
no_selection_reviews_head_and_never_commits_unrelated_dirt
selected_symlink_is_a_blob_and_never_opens_its_target
path_guards_refuse_before_changing_head_or_index
main_detached_missing_main_and_unrelated_history_refuse_before_checkpoint
matching_start_resumes_same_session_without_new_refs
changed_content_creates_successor_and_preserves_previous_checkpoint
advanced_head_creates_successor_without_reusing_old_finished_sha
status_is_read_only_and_lists_legacy_and_corrupt_records
resume_keeps_dirty_review_files_and_reports_blocker
main_advance_does_not_change_frozen_review_scope_on_resume
original_and_finished_urls_bind_exact_tree_and_encode_special_paths
dirty_or_advanced_original_url_is_never_labelled_verified
missing_entry_never_substitutes_another_version
active_review_cannot_be_cleaned
empty_verified_flag_and_empty_evidence_are_not_adoption
successful_independent_no_fix_review_completes_and_cleans_managed_trees
successful_fix_fast_forwards_exact_reviewed_sha_and_retains_recovery_refs
each_required_evidence_gate_blocks_an_otherwise_valid_review
evidence_reports_cannot_escape_or_traverse_a_symlink
normal_main_differences_do_not_waive_or_replace_checkpoint_preservation
unknown_operation_lock_is_preserved_and_never_treated_as_stale
start_retry_cleans_eligible_completed_retained_workspaces
interrupted_checkpoint_after_ref_update_preserves_unrelated_index_on_resume
active_workers_and_role_reuse_block_adoption
dirty_original_staged_unstaged_and_untracked_all_block_adoption
advanced_original_or_other_branch_never_receives_review_merge
review_advance_after_verifier_stopped_invalidates_attestation
app_channels_and_main_comparison_remain_separate_adoption_gates
flow_requires_its_own_checkpoint_comparison_and_checks
full_app_evidence_rejects_narrowed_or_missing_comparator_commands
ignored_collision_refuses_adoption_and_resume_preserving_original
managed_hidden_index_flags_block_verification_and_verified_preview
hidden_index_flags_preserve_bytes_during_cleanup_retries
original_hidden_index_flags_block_adoption_without_changing_index
completed_cleanup_refuses_dirty_ignored_advanced_or_mismatched_worktree
completed_preview_falls_back_to_exact_original_and_evidence_can_go_stale
phase_completed_without_bound_adoption_does_not_authorize_cleanup
completed_resume_and_adopt_never_report_missing_evidence_fresh
weakened_synthetic_harness_cannot_replace_independent_checkpoint_control
interrupted_after_real_merge_resumes_by_inspection_without_second_merge
successor_ref_interruption_repairs_links_and_allows_completed_ancestor_cleanup
cleaned_historical_preview_never_substitutes_advanced_original_task
status_isolates_malformed_recognized_record_and_preserves_healthy_record
dirty_stopped_predecessor_is_preserved_through_successor_completion
actual_worker_stop_preserves_dirty_files_without_granting_verification
completed_cleanup_retains_clean_tree_with_in_progress_merge
'''.split()
for _scenario in _SHARED:
    _name = 'test_' + _scenario
    setattr(IndependentReviewTest, _name, getattr(legacy_contract.PrePrReviewTest, _name))
