package com.interviewPlatform.dtos.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;

public record InstituteRegisterRequest(
     @NotBlank(message = "Institute Name is required")
     String instituteName,
     @NotBlank(message = "University Name is required")
     String university,
     @NotBlank(message = "Institute Code is required")
     String instituteCode,
     @NotBlank(message = "Address is required")
     String address,
     @NotBlank(message = "City is required")
     String city,
     @NotBlank(message = "State is required")
     String state,

     @NotBlank(message = "Admin Name is required")
     String adminName,
     @NotBlank(message = "Designation is required")
     String designation,
     @NotBlank(message = "Email is required")
     @Email(message = "Invalid email format")
     String email,
     @NotBlank(message = "Contact number is required")
     String contactNumber,

     String website,
     
     @NotNull(message = "Student strength is required")
     @Min(value = 1, message = "Student strength must be greater than 0")
     Integer studentStrength,

     @NotBlank(message = "Password is required")
     @Size(min = 6, message = "Password must be at least 6 characters long")
     String password,
     @NotBlank(message = "Confirm password is required")
     String confirmPassword
) {

}
