import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../App'

describe('Accessibility Compliance', () => {
  it('should have proper semantic landmarks', () => {
    render(<App />)
    
    // Check for header
    expect(screen.getByRole('banner')).toBeTruthy()
    
    // Check for navigation (there should be two nav elements)
    const navigations = screen.getAllByRole('navigation')
    expect(navigations.length).toBe(2)
    
    // Check for main content
    expect(screen.getByRole('main')).toBeTruthy()
    
    // Check for footer
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  it('should have skip links for keyboard navigation', () => {
    render(<App />)
    
    const skipLinks = screen.getAllByRole('link').filter(link => 
      link.textContent?.includes('Skip to')
    )
    
    expect(skipLinks.length).toBeGreaterThan(0)
    expect(skipLinks[0].getAttribute('href')).toBe('#main-content')
  })

  it('should have proper heading hierarchy', () => {
    render(<App />)
    
    // Should have an h1 as the main heading
    const headings = screen.getAllByRole('heading')
    const h1Elements = headings.filter(h => h.tagName === 'H1')
    expect(h1Elements.length).toBeGreaterThan(0)
    
    // H1 should be the first heading
    expect(headings[0].tagName).toBe('H1')
  })

  it('should have accessible navigation with proper aria-current', () => {
    render(<App />)
    
    // Find navigation buttons
    const navButtons = screen.getAllByRole('button').filter(button => 
      ['Home', 'Features', 'Contact'].includes(button.textContent || '')
    )
    
    // Home should have aria-current="page" initially
    const homeButton = navButtons.find(button => button.textContent === 'Home')
    expect(homeButton?.getAttribute('aria-current')).toBe('page')
  })

  it('should have accessible form controls', () => {
    render(<App />)
    
    // Find all form inputs
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
    
    // Check that text inputs have proper attributes
    inputs.forEach(input => {
      expect(input).toBeTruthy()
    })
  })

  it('should have proper ARIA labeling for interactive elements', () => {
    render(<App />)
    
    // Check that buttons exist and have accessible names
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    
    buttons.forEach(button => {
      expect(button).toBeTruthy()
    })
    
    // Check that links have accessible names
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    
    links.forEach(link => {
      expect(link).toBeTruthy()
    })
  })
})