import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('GitHub Sponsorship Configuration', () => {
  const fundingYmlPath = join(process.cwd(), '.github', 'FUNDING.yml');
  const sponsorshipDocsPath = join(process.cwd(), 'docs', 'SPONSORSHIP_PLATFORMS.md');

  it('should have a FUNDING.yml file in .github directory', () => {
    expect(existsSync(fundingYmlPath)).toBe(true);
  });

  it('should have Buy Me a Coffee configured', () => {
    const content = readFileSync(fundingYmlPath, 'utf8');
    expect(content).toContain('buymeacoffee.com/wiiiimm');
    expect(content).toContain('custom:');
  });

  it('should contain Ko-fi configuration examples', () => {
    const content = readFileSync(fundingYmlPath, 'utf8');
    expect(content).toContain('ko_fi');
    expect(content).toContain('Buy Me Coffee alternative');
  });

  it('should contain custom URL examples for Buy Me a Coffee', () => {
    const content = readFileSync(fundingYmlPath, 'utf8');
    expect(content).toContain('buymeacoffee.com');
    expect(content).toContain('custom');
  });

  it('should list all supported platforms in comments', () => {
    const content = readFileSync(fundingYmlPath, 'utf8');
    const expectedPlatforms = [
      'patreon',
      'open_collective', 
      'tidelift',
      'community_bridge',
      'liberapay',
      'issuehunt',
      'otechie'
    ];
    
    expectedPlatforms.forEach(platform => {
      expect(content).toContain(platform);
    });
  });

  it('should have comprehensive sponsorship documentation', () => {
    expect(existsSync(sponsorshipDocsPath)).toBe(true);

    // The guide was rewritten to focus solely on Buy Me a Coffee (SWR-367), so
    // assert the current single-platform structure rather than the old
    // multi-platform headings (Ko-fi / Custom URLs).
    const content = readFileSync(sponsorshipDocsPath, 'utf8');
    expect(content).toContain('GitHub Sponsorship Configuration Guide');
    expect(content).toContain('Buy Me a Coffee');
    expect(content).toContain('Why Support This Project?');
  });

  it('should have proper YAML structure', () => {
    const content = readFileSync(fundingYmlPath, 'utf8');
    
    // Should not have syntax errors - basic checks
    expect(content).not.toContain('syntax error');
    expect(content).toMatch(/github:\s+wiiiimm/);
    
    // Should have proper commenting for inactive platforms
    const lines = content.split('\n');
    const commentedPlatforms = lines.filter(line => 
      line.trim().startsWith('#') && 
      (line.includes('ko_fi:') || line.includes('patreon:') || line.includes('custom:'))
    );
    
    expect(commentedPlatforms.length).toBeGreaterThan(0);
  });

  it('should have a Support & Sponsorship section in README', () => {
    const readmePath = join(process.cwd(), 'README.md');
    const content = readFileSync(readmePath, 'utf8');

    // README sponsorship section was simplified to the active platforms only
    // (SWR-367): GitHub Sponsors + Buy Me a Coffee. Ko-fi and the
    // SPONSORSHIP_PLATFORMS.md link are no longer referenced here.
    expect(content).toContain('Support & Sponsorship');
    expect(content).toContain('GitHub Sponsors');
    expect(content).toContain('Buy Me a Coffee');
  });
});