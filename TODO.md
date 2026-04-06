calendar
i can at this rate just add a sqlite

make ready for this:

```json
{
  "Total_count": 176,
  "Found_distinct": 3,
  "Errors": [
    {
      "Error": "KeyError: 'Case ID' - Pandas DataFrame missing expected column 'Case ID' when attempting to retrieve records for global distribution",
      "Key_problem": "**cases_dataframe['Case ID']** - DataFrame does not contain 'Case ID' column at data_service.py:607",
      "Multiple_count": true,
      "Importance": "Very High",
      "Count": 33,
      "Affected_IDs": [
        "00XXX00000XXXXXX"
      ],
      "Affected_Files": [
        {
          "Affected_File": "C:\\Projects\\application\\api\\services\\data_service.py",
          "Line": "607"
        },
        {
          "Affected_File": "C:\\Projects\\application\\api\\views\\data_service.py",
          "Line": "234"
        }
      ]
    },
    {
      "Error": "Internal Server Error: /service/api/get_cases_global_distribution/ - HTTP 500 error returned to client",
      "Key_problem": "**HTTP 500 Internal Server Error** - API endpoint failing due to upstream KeyError exception",
      "Multiple_count": true,
      "Importance": "Very High",
      "Count": 33,
      "Affected_IDs": [
        "00XXX00000XXXXXX"
      ],
      "Affected_Files": [
        {
          "Affected_File": "/service/api/get_cases_global_distribution/",
          "Line": "n/A"
        }
      ]
    },
    {
      "Error": "Initial connection established, but the request timed out to detect language",
      "Key_problem": "**Connection timeout** - Language detection request exceeded timeout threshold after initial connection",
      "Multiple_count": true,
      "Importance": "Moderate",
      "Count": 110,
      "Affected_IDs": [
        "n/A"
      ],
      "Affected_Files": [
        {
          "Affected_File": "n/A",
          "Line": "n/A"
        }
      ]
    }
  ]
}
```

