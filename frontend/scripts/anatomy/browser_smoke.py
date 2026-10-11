"""Real Chromium smoke checks. Requires Python Playwright and Chromium.

API: python scripts/anatomy/browser_smoke.py --fixture /tmp/demo/fixture.json --backend http://127.0.0.1:8001
Mock: python scripts/anatomy/browser_smoke.py --url http://localhost:3001 --mock
Writes only when given the isolated SYNTHETIC fixture; normal seed checks are read-only.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://localhost:3000')
parser.add_argument('--backend')
parser.add_argument('--fixture', type=Path)
parser.add_argument('--mock', action='store_true')
parser.add_argument('--chromium', default='/usr/bin/chromium')
parser.add_argument('--output', type=Path, default=Path('/tmp/anatomy-browser-shots'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
fixture = json.loads(args.fixture.read_text()) if args.fixture else None
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.chromium, headless=True,
        args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1600, 'height': 1200})
    page.set_default_timeout(60000)
    errors = []
    def report_error(error):
        errors.append(error.stack)
        print('BROWSER ERROR:', error.stack, flush=True)
    page.on('pageerror', report_error)
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    if args.backend:
        def proxy(route):
            path = urlparse(route.request.url)
            response = route.fetch(url=args.backend + path.path + ('?' + path.query if path.query else ''))
            route.fulfill(response=response)
        page.route('**/api/**', proxy)
    def ready(case_id):
        page.goto(f'{args.url}/cases/{case_id}/autopsy')
        expect(page.get_by_role('button', name='Explode', exact=True)).to_be_enabled(timeout=60000)
        expect(page.locator('canvas')).to_have_count(1)
        page.get_by_test_id('anatomy-canvas').scroll_into_view_if_needed()
        page.wait_for_timeout(1000)
    ready(1)
    expect(page.get_by_test_id('finding-injury:1')).to_contain_text('clavicle')
    expect(page.get_by_test_id('finding-injury:2')).to_contain_text('Forehead')
    expect(page.get_by_test_id('finding-injury:3')).to_contain_text('upper arm')
    expect(page.locator('#anatomy-person')).to_contain_text('Rohan Kapoor · Injured')
    assert page.locator('canvas').bounding_box()['height'] >= 600
    canvas = page.locator('canvas').element_handle()
    viewport = page.get_by_test_id('anatomy-canvas')
    viewport.screenshot(path=str(args.output / 'intact.png'))
    box = viewport.bounding_box()
    page.mouse.move(box['x']+box['width']*.5, box['y']+box['height']*.5)
    page.mouse.wheel(0, -350)
    page.wait_for_timeout(500)
    progress = page.get_by_role('slider', name='Explosion progress')
    assert 0 < float(progress.input_value()) < 1
    page.mouse.wheel(0, 350)
    expect(progress).to_have_value('0')
    page.get_by_role('button', name='Explode', exact=True).click()
    expect(progress).to_have_value('1')
    page.wait_for_timeout(1500)
    viewport.screenshot(path=str(args.output / 'exploded.png'))
    before_zoom = hashlib.sha256(viewport.screenshot()).digest()
    page.get_by_role('button', name='Zoom in', exact=True).click()
    page.wait_for_timeout(1200)
    assert progress.input_value() == '1'
    assert hashlib.sha256(viewport.screenshot()).digest() != before_zoom
    # Clicking real geometry in the organized view (heart is central, third row).
    page.get_by_role('button', name='Front', exact=True).click()
    page.wait_for_timeout(1200)
    box = viewport.bounding_box()
    page.mouse.click(box['x']+box['width']*.5, box['y']+box['height']*.325)
    expect(page.get_by_test_id('anatomy-mode')).to_have_text('Organ inspection')
    page.get_by_test_id('organ-heart').click()
    expect(page.get_by_role('complementary', name='Medical findings inspector')).to_contain_text('Not documented')
    page.wait_for_timeout(1200)
    viewport.screenshot(path=str(args.output / 'heart.png'))
    assert page.evaluate('(old) => old === document.querySelector("canvas")', canvas)
    # Rotation and pan change the rendered view while staying in organ focus.
    box = viewport.bounding_box()
    for button, dx in [('left', 80), ('right', 35)]:
        before = hashlib.sha256(viewport.screenshot()).digest()
        page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
        page.mouse.down(button=button)
        page.mouse.move(box['x']+box['width']/2+dx, box['y']+box['height']/2+20, steps=8)
        page.mouse.up(button=button)
        page.wait_for_timeout(800)
        assert hashlib.sha256(viewport.screenshot()).digest() != before
    page.get_by_role('button', name='Return to anatomy', exact=True).click()
    expect(progress).to_have_value('1')
    for organ in ['liver', 'kidney_left', 'heart']:
        page.get_by_test_id('organ-'+organ).click()
    page.get_by_role('button', name='Reassemble', exact=True).click()
    expect(progress).to_have_value('0')
    expect(page.get_by_test_id('anatomy-mode')).to_have_text('Intact reference body')
    assert page.evaluate('(old) => old === document.querySelector("canvas")', canvas)
    page.get_by_role('button', name='Select injury 1', exact=True).click()
    expect(page.get_by_test_id('finding-injury:1')).to_contain_text('Confirmed')
    page.get_by_title('Open Medical report: Rohan Kapoor at this passage').click()
    expect(page.get_by_role('dialog', name='Evidence inspector')).to_be_visible()
    assert 'evidence=' in page.url and 'passage=' in page.url
    page.get_by_role('button', name='Close inspector').click()
    page.locator('#anatomy-person').select_option(label='Unassigned findings — no person')
    expect(page.get_by_test_id('finding-injury:1')).to_have_count(0)
    expect(page.get_by_test_id('finding-injury:2')).to_have_count(0)
    print('PASS: seed, intact/exploded camera, mesh selection, retained canvas, reversal, citations, unassigned isolation', flush=True)
    if fixture:
        assert args.backend, 'Synthetic mutations require a separate backend'
        ready(fixture['case_id'])
        expect(page.get_by_role('heading', name='SYNTHETIC — Anatomy demonstration')).to_be_visible()
        inspector = page.get_by_role('complementary', name='Medical findings inspector')
        injury = page.get_by_test_id(f"finding-injury:{fixture['injury_id']}")
        expect(injury).to_contain_text('Severity not documented')
        page.locator('#anatomy-report-kind').select_option('postmortem')
        page.locator('#anatomy-report').select_option(str(fixture['evidence_id']))
        expect(page.get_by_role('button', name='Analyse / reanalyse report')).to_be_disabled()
        page.get_by_test_id('organ-liver').click()
        expect(inspector).to_contain_text('Explicitly normal')
        page.get_by_test_id('organ-heart').click()
        expect(inspector).to_contain_text('uncertain')
        page.get_by_test_id('organ-lung_left').click()
        injury.get_by_role('button', name='Confirm', exact=True).click()
        expect(injury).to_contain_text('Confirmed AI proposal')
        injury.get_by_role('button', name=re.compile(r'^Contusion #')).click()
        injury.get_by_role('button', name='Adjust illustrative marker').click()
        viewport.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        box = viewport.bounding_box()
        page.mouse.click(box['x']+box['width']/2, box['y']+box['height']/2)
        expect(injury).to_contain_text('Regional · Investigator')
        page.reload()
        expect(page.get_by_role('button', name='Explode', exact=True)).to_be_enabled()
        expect(page.get_by_test_id(f"finding-injury:{fixture['injury_id']}")).to_contain_text('Regional · Investigator')
        page.get_by_test_id('organ-heart').click()
        uncertain = page.get_by_test_id(f"finding-anatomy_finding:{fixture['uncertain_id']}")
        uncertain.get_by_role('button', name='Reject', exact=True).click()
        expect(uncertain).to_have_count(0)
        expect(page.get_by_role('button', name=f"Select finding {fixture['uncertain_id']}", exact=True)).to_have_count(0)
        page.get_by_role('combobox', name='Findings review filter').select_option('rejected')
        expect(uncertain).to_contain_text('Rejected')
        page.get_by_role('combobox', name='Findings review filter').select_option('all')
        page.locator('#anatomy-person').select_option(str(fixture['other_person_id']))
        expect(inspector).to_contain_text('SYNTHETIC Sam upper-arm bruise.')
        expect(page.get_by_test_id(f"finding-injury:{fixture['injury_id']}")).to_have_count(0)
        page.locator('#anatomy-person').select_option('unassigned')
        expect(inspector).to_contain_text('SYNTHETIC unassigned finding.')
        print('PASS: synthetic postmortem, normal/uncertain, review, persisted marker, rejected badges, person isolation, no-AI', flush=True)
    assert not errors, '\n'.join(errors)
    browser.close()
    print('PASS: no browser runtime errors', flush=True)
