$baseUrl = "http://localhost:8000"

# Step 1: Login
Write-Host "Logging in..."
$authBody = @{ email = "demo@xeno.ai"; password = "demo123" } | ConvertTo-Json -Depth 5
$authResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $authBody -ContentType "application/json"
$token = $authResponse.access_token
$headers = @{ Authorization = "Bearer $token" }
Write-Host "Token obtained."

# Step a: POST to /api/ai/segment
Write-Host "`n--- Step A: POST to /api/ai/segment ---"
$aiSegmentBody = @{ query = "customers who spent over 5000 and are gold tier" } | ConvertTo-Json -Depth 5
$fallbackUsed = $false
try {
    $aiSegmentResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai/segment" -Method Post -Body $aiSegmentBody -ContentType "application/json" -Headers $headers
    Write-Host "PASS: AI Segment Response obtained."
    $aiSegmentResponse | ConvertTo-Json -Depth 5
    $filterRules = $aiSegmentResponse.filter_rules
    $suggestedName = $aiSegmentResponse.suggested_name
} catch {
    Write-Host "FAIL: AI Segment Response failed. Error: $_"
    # Capture detailed error if possible
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errText = $reader.ReadToEnd()
        Write-Host "Server Error Detail: $errText"
    }
    Write-Host "Falling back to manual segment rules for subsequent tests..."
    $fallbackUsed = $true
    $filterRules = @{
        operator = "AND"
        conditions = @(
            @{ field = "total_spent"; op = "gt"; value = 5000 },
            @{ field = "loyalty_tier"; op = "eq"; value = "gold" }
        )
    }
    $suggestedName = "Manual High-Value Gold Tier"
}

# Step b: Create segment
Write-Host "`n--- Step B: Create segment via /api/segments ---"
$segmentBody = @{
    name = $suggestedName
    filter_rules = $filterRules
    created_by_ai = ($fallbackUsed -eq $false)
    nl_query = "customers who spent over 5000 and are gold tier"
} | ConvertTo-Json -Depth 5
try {
    $segmentResponse = Invoke-RestMethod -Uri "$baseUrl/api/segments" -Method Post -Body $segmentBody -ContentType "application/json" -Headers $headers
    Write-Host "PASS: Segment created successfully."
    $segmentResponse | ConvertTo-Json -Depth 5
    $segmentId = $segmentResponse.id
} catch {
    Write-Host "FAIL: Create segment failed. Error: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Server Error Detail: $($reader.ReadToEnd())"
    }
    exit
}

# Preview segment
Write-Host "`nPreviewing segment $segmentId..."
try {
    $previewResponse = Invoke-RestMethod -Uri "$baseUrl/api/segments/$segmentId/preview" -Method Get -Headers $headers
    Write-Host "PASS: Segment preview succeeded."
    $previewResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAIL: Segment preview failed. Error: $_"
}

# Step c: Create campaign
Write-Host "`n--- Step C: Create campaign via /api/campaigns ---"
$campaignBody = @{
    name = "Gold Tier Spent > 5000 Campaign"
    segment_id = $segmentId
    message = "Hello {{name}}, as a Gold tier member who spent {{total_spent}}, here is a 20% discount!"
    channel = "email"
} | ConvertTo-Json -Depth 5
try {
    $campaignResponse = Invoke-RestMethod -Uri "$baseUrl/api/campaigns" -Method Post -Body $campaignBody -ContentType "application/json" -Headers $headers
    Write-Host "PASS: Campaign created successfully."
    $campaignResponse | ConvertTo-Json -Depth 5
    $campaignId = $campaignResponse.id
} catch {
    Write-Host "FAIL: Create campaign failed. Error: $_"
    exit
}

# Launch campaign
Write-Host "`nLaunching campaign $campaignId..."
try {
    $launchResponse = Invoke-RestMethod -Uri "$baseUrl/api/campaigns/$campaignId/launch" -Method Post -Headers $headers
    Write-Host "PASS: Campaign launch api call succeeded."
    $launchResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAIL: Campaign launch api call failed. Error: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Server Error Detail: $($reader.ReadToEnd())"
    }
}

# Sleep to let Celery and simulator process messages
Write-Host "`nWaiting 35 seconds for Celery worker & Channel simulator..."
Start-Sleep -Seconds 35

# Step f: Call campaign analytics
Write-Host "`n--- Step F: Campaign analytics via /api/campaigns/{id}/analytics ---"
try {
    $analyticsResponse = Invoke-RestMethod -Uri "$baseUrl/api/campaigns/$campaignId/analytics" -Method Get -Headers $headers
    Write-Host "PASS: Campaign analytics retrieved."
    $analyticsResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAIL: Campaign analytics failed. Error: $_"
}

# Step g: AI Agent SSE check
Write-Host "`n--- Step G: Test AI agent via POST to /api/ai/agent ---"
$agentBody = @{ goal = "recover inactive premium customers" } | ConvertTo-Json -Depth 5

try {
    $httpClient = New-Object System.Net.Http.HttpClient
    $httpClient.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
    $content = New-Object System.Net.Http.StringContent($agentBody, [System.Text.Encoding]::UTF8, "application/json")
    $response = $httpClient.PostAsync("$baseUrl/api/ai/agent", $content).Result
    if ($response.IsSuccessStatusCode) {
        Write-Host "PASS: SSE Connection Successful. Reading first 50 lines or up to 15 seconds..."
        $stream = $response.Content.ReadAsStreamAsync().Result
        $reader = New-Object System.IO.StreamReader($stream)
        $lineCount = 0
        $startTime = [DateTime]::Now
        while (-not $reader.EndOfStream -and $lineCount -lt 50 -and ([DateTime]::Now - $startTime).TotalSeconds -lt 15) {
            $line = $reader.ReadLine()
            if ($line) {
                Write-Host $line
                $lineCount++
            }
        }
        $reader.Close()
    } else {
        Write-Host "FAIL: Agent SSE request failed: $($response.StatusCode)"
        $errText = $response.Content.ReadAsStringAsync().Result
        Write-Host "Server Error Detail: $errText"
    }
} catch {
    Write-Host "FAIL: AI agent call errored. Error: $_"
}
