import React, { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  preferredContact: 'email' | 'phone';
  phone: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  phone?: string;
}

const Contact: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    preferredContact: 'email',
    phone: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\d\s\-\(\)]+$/;
    return phone === '' || phoneRegex.test(phone);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters long';
    }

    if (formData.preferredContact === 'phone' && !formData.phone.trim()) {
      newErrors.phone = 'Phone number is required when phone contact is preferred';
    } else if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleRadioChange = (value: 'email' | 'phone') => {
    setFormData(prev => ({ ...prev, preferredContact: value }));
    if (value === 'email' && errors.phone) {
      const newErrors = { ...errors };
      delete newErrors.phone;
      setErrors(newErrors);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Focus on first error field
      const firstErrorField = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
      element?.focus();
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        preferredContact: 'email',
        phone: ''
      });
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page">
      <header>
        <h1>Contact Us</h1>
        <p style={{ fontSize: '1.125rem', lineHeight: '1.6', maxWidth: '800px', margin: '1rem 0' }}>
          We're committed to making healthcare accessible to everyone. If you have questions 
          about our accessibility features or need assistance, please reach out.
        </p>
      </header>

      <section aria-labelledby="contact-info" style={{ marginBottom: '3rem' }}>
        <h2 id="contact-info">Get in Touch</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '2rem',
          marginTop: '2rem'
        }}>
          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>📧 Email Support</h3>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>General Inquiries:</strong> support@healthapp.com
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Accessibility:</strong> accessibility@healthapp.com
            </p>
            <p style={{ margin: 0 }}>
              <strong>Response Time:</strong> Within 24-48 hours
            </p>
          </div>
          
          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>📞 Phone Support</h3>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Main Line:</strong> 1-800-HEALTH-APP
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>TTY:</strong> 711 (for hearing impaired)
            </p>
            <p style={{ margin: 0 }}>
              <strong>Hours:</strong> Monday-Friday, 9AM-6PM EST
            </p>
          </div>
          
          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>♿ Accessibility Resources</h3>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Screen Reader Support:</strong> Available
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Language Services:</strong> Multiple languages
            </p>
            <p style={{ margin: 0 }}>
              <strong>Alternate Formats:</strong> Large print, Braille
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-form-heading">
        <h2 id="contact-form-heading">Send Us a Message</h2>
        
        {submitStatus === 'success' && (
          <div 
            role="alert" 
            style={{
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              color: '#155724',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1.5rem'
            }}
          >
            ✅ Thank you for your message! We'll get back to you within 24-48 hours.
          </div>
        )}

        {submitStatus === 'error' && (
          <div 
            role="alert" 
            style={{
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              color: '#721c24',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1.5rem'
            }}
          >
            ❌ Sorry, there was an error sending your message. Please try again or contact us directly.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="name">
                Full Name
                <span className="required" style={{ color: '#dc3545' }} aria-label="required"> *</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={errors.name ? 'name-error' : undefined}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: errors.name ? '2px solid #dc3545' : '2px solid #ced4da',
                  borderRadius: '4px',
                  marginTop: '0.5rem'
                }}
                required
              />
              {errors.name && (
                <div id="name-error" className="error" role="alert">
                  {errors.name}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="email">
                Email Address
                <span className="required" style={{ color: '#dc3545' }} aria-label="required"> *</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: errors.email ? '2px solid #dc3545' : '2px solid #ced4da',
                  borderRadius: '4px',
                  marginTop: '0.5rem'
                }}
                required
              />
              {errors.email && (
                <div id="email-error" className="error" role="alert">
                  {errors.email}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="subject">
                Subject
                <span className="required" style={{ color: '#dc3545' }} aria-label="required"> *</span>
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={formData.subject}
                onChange={handleInputChange}
                aria-invalid={errors.subject ? 'true' : 'false'}
                aria-describedby={errors.subject ? 'subject-error' : undefined}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: errors.subject ? '2px solid #dc3545' : '2px solid #ced4da',
                  borderRadius: '4px',
                  marginTop: '0.5rem'
                }}
                required
              />
              {errors.subject && (
                <div id="subject-error" className="error" role="alert">
                  {errors.subject}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="message">
                Message
                <span className="required" style={{ color: '#dc3545' }} aria-label="required"> *</span>
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                aria-invalid={errors.message ? 'true' : 'false'}
                aria-describedby={errors.message ? 'message-error' : 'message-help'}
                rows={5}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: errors.message ? '2px solid #dc3545' : '2px solid #ced4da',
                  borderRadius: '4px',
                  marginTop: '0.5rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                required
              />
              <div id="message-help" style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                Please provide at least 10 characters to help us understand your inquiry.
              </div>
              {errors.message && (
                <div id="message-error" className="error" role="alert">
                  {errors.message}
                </div>
              )}
            </div>

            <fieldset style={{ 
              border: '2px solid #ced4da', 
              borderRadius: '4px', 
              padding: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              <legend style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                Preferred Contact Method
                <span className="required" style={{ color: '#dc3545' }} aria-label="required"> *</span>
              </legend>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input
                    type="radio"
                    name="preferredContact"
                    value="email"
                    checked={formData.preferredContact === 'email'}
                    onChange={() => handleRadioChange('email')}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Email
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="preferredContact"
                    value="phone"
                    checked={formData.preferredContact === 'phone'}
                    onChange={() => handleRadioChange('phone')}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Phone
                </label>
              </div>

              {formData.preferredContact === 'phone' && (
                <div>
                  <label htmlFor="phone" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Phone Number
                    <span className="required" style={{ color: '#dc3545' }} aria-label="required"> *</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    aria-invalid={errors.phone ? 'true' : 'false'}
                    aria-describedby={errors.phone ? 'phone-error' : 'phone-help'}
                    placeholder="(555) 123-4567"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: errors.phone ? '2px solid #dc3545' : '2px solid #ced4da',
                      borderRadius: '4px'
                    }}
                    required={formData.preferredContact === 'phone'}
                  />
                  <div id="phone-help" style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    Include area code for US numbers
                  </div>
                  {errors.phone && (
                    <div id="phone-error" className="error" role="alert">
                      {errors.phone}
                    </div>
                  )}
                </div>
              )}
            </fieldset>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: '#0066cc',
                  color: 'white',
                  border: '2px solid #0066cc',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.6 : 1,
                  minWidth: '44px',
                  minHeight: '44px'
                }}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    name: '',
                    email: '',
                    subject: '',
                    message: '',
                    preferredContact: 'email',
                    phone: ''
                  });
                  setErrors({});
                  setSubmitStatus('idle');
                }}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: '2px solid #6c757d',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px'
                }}
              >
                Clear Form
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Contact;