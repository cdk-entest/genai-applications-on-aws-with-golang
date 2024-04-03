---
title: getting started with amazon bedrock in go
author: haimtran
date: 25/03/2024
---

## Introduction

**Video demo**

[![screencast thumbnail](./image/video.png)](https://d2cvlmmg8c0xrp.cloudfront.net/demo/go-bedrock-demo.mp4)

**Architecture**

![architecture-diagram](./assets/arch.png)

This repo shows how to get started with Amazon Bedrock in golang through basic examples.

- simple chat and prompt
- query vector database (opensearch)
- simple image analyzing

For learning purpose, it implement these features using only basic concepts and without relying on framework like LangChain, Streamlit, or React.

- basic stream response
- basic css and javascript

## WebServer

Project structure

```go
|--image
   |--demo.jpeg
|--static
   |--claude-haiku.html
   |--claude2.html
   |--image.html
   |--opensearch.html
|--aoss.go
|--bedrock.go
|--constants.go
|--go.mod
|--main.go
```

main.go implement a http server and route request to handlers. bedrock.go and aoss.go are functions to invoke Amazon Bedrock and Amazon OpenSearch Serverless (AOSS), respecitively. static folder contains simple frontend with javascript.

> [!IMPORTANT]  
> To use AOSS, you need create a OpenSearch collection and provide its URL endpoint in constants.go. In addition, you need to setup data access in the AOSS for the running time environment (EC2 profile, ECS taks role, Lambda role, .etc)

## Stream Response

First it is good to create some data structs according to [Amazon Bedrock Claude3 API format]()

```go
type Content struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type Message struct {
	Role    string    `json:"role"`
	Content []Content `json:"content"`
}

type Body struct {
	MaxTokensToSample int       `json:"max_tokens"`
	Temperature       float64   `json:"temperature,omitempty"`
	AnthropicVersion  string    `json:"anthropic_version"`
	Messages          []Message `json:"messages"`
}

// list of messages
messages := []Message{{
	Role:    "user",
	Content: []Content{{Type: "text", Text: promt}},
}}

// form request body
payload := Body{
	MaxTokensToSample: 2048,
	Temperature:       0.9,
	AnthropicVersion:  "bedrock-2023-05-31",
	Messages:          messages,
}
```

Then convert the payload to bytes and invoke Bedrock client

```go
payload := Body{
	MaxTokensToSample: 2048,
	Temperature:       0.9,
	AnthropicVersion:  "bedrock-2023-05-31",
	Messages:          messages,
}

// marshal payload to bytes
payloadBytes, err := json.Marshal(payload)

if err != nil {
	fmt.Println(err)
	return
}

// create request to bedrock
output, error := BedrockClient.InvokeModelWithResponseStream(
	context.Background(),
	&bedrockruntime.InvokeModelWithResponseStreamInput{
		Body:        payloadBytes,
		ModelId:     aws.String("anthropic.claude-3-haiku-20240307-v1:0"),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
	},
)

if error != nil {
	fmt.Println(error)
	return
}
```

Finally, parse the streaming reponse and decode to text. When deploy on a http server, we need to modify the code a bit to stream each chunk of response to client. For example [HERE]()

```go
output, error := BedrockClient.InvokeModelWithResponseStream(
	context.Background(),
	&bedrockruntime.InvokeModelWithResponseStreamInput{
		Body:        payloadBytes,
		ModelId:     aws.String("anthropic.claude-3-haiku-20240307-v1:0"),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
	},
)

if error != nil {
	fmt.Println(error)
	return
}

// parse response stream
for event := range output.GetStream().Events() {
	switch v := event.(type) {
	case *types.ResponseStreamMemberChunk:

		//fmt.Println("payload", string(v.Value.Bytes))

		var resp ResponseClaude3
		err := json.NewDecoder(bytes.NewReader(v.Value.Bytes)).Decode(&resp)
		if err != nil {
			fmt.Println(err)
		}

		fmt.Println(resp.Delta.Text)

	case *types.UnknownUnionMember:
		fmt.Println("unknown tag:", v.Tag)

	default:
		fmt.Println("union is nil or unknown type")
	}
}
```

## Image Analyze

Similarly, for image analyzing using Amazon Bedrock Claude3, we need to create a correct request format. It is possible without explicitly define structs as above and using interface{}

```go
// read image from local file
imageData, error := ioutil.ReadFile("demo.jpeg")

if error != nil {
	fmt.Println(error)
}

// encode image to base64
base64Image := base64.StdEncoding.EncodeToString(imageData)

source := map[string]interface{}{
		"type":       "base64",
		"media_type": "image/jpeg",
		"data":       base64Image,
	}

messages := []map[string]interface{}{{
	"role":    "user",
	"content": []map[string]interface{}{{"type": "image", "source": source}, {"type": "text", "text": "what is in this image?"}},
}}

payload := map[string]interface{}{
	"max_tokens":        2048,
	"anthropic_version": "bedrock-2023-05-31",
	"temperature":       0.9,
	"messages":          messages,
}
```

Then invoke Amazon Bedrock Client like below, and similar for streaming reponse as previous example.

```go
// convert payload struct to bytes
payloadBytes, error := json.Marshal(payload)

if error != nil {
	fmt.Println(error)
}

// invoke bedrock claude3 haiku
output, error := BedrockClient.InvokeModel(
	context.Background(),
	&bedrockruntime.InvokeModelInput{
		Body:        payloadBytes,
		ModelId:     aws.String("anthropic.claude-3-haiku-20240307-v1:0"),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
	},
)

if error != nil {
	fmt.Println(error)
}

// response
fmt.Println(string(output.Body))
```

## OpenSearch

- create OpenSearch client
- convert user question to embedding vector
- send query or request to OpenSearch

A OpenSearch and Bedrock client can be initialized as below

<details>
<summary>InitOpenSearchBedrockClient</summary>

```go
// opensearch severless client
var AOSSClient *opensearch.Client

// bedrock client
var BedrockClient *bedrockruntime.Client

// create an init function to initializing opensearch client
func init() {

	//
	fmt.Println("init and create an opensearch client")

	// load aws credentials from profile demo using config
	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion("us-east-1"),
	)

	if err != nil {
		log.Fatal(err)
	}

	// create bedorck runtime client
	BedrockClient = bedrockruntime.NewFromConfig(awsCfg)

	// create a aws request signer using requestsigner
	signer, err := requestsigner.NewSignerWithService(awsCfg, "aoss")

	if err != nil {
		log.Fatal(err)
	}

	uncommen for opensearch client
	create an opensearch client using opensearch package
	AOSSClient, err = opensearch.NewClient(opensearch.Config{
		Addresses: []string{AOSS_ENDPOINT},
		Signer:    signer,
	})

	if err != nil {
		log.Fatal(err)
	}
}
```

</details>

Create a function to convert text to vector by invoking Amazon Bedrock Titan model.

<details>
<summary>GetEmbedVector</summary>

```go
func GetEmbedVector(qustion string) ([]float64, error) {

	// create request body to titan model
	body := map[string]interface{}{
		"inputText": qustion,
	}
	bodyJson, err := json.Marshal(body)

	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	// invoke bedrock titan model to convert string to embedding vector
	response, error := BedrockClient.InvokeModel(
		context.Background(),
		&bedrockruntime.InvokeModelInput{
			Body:        []byte(bodyJson),
			ModelId:     aws.String("amazon.titan-embed-text-v1"),
			ContentType: aws.String("application/json"),
		},
	)

	if error != nil {
		fmt.Println(error)
		return nil, error
	}

	// assert response to map
	var embedResponse map[string]interface{}

	error = json.Unmarshal(response.Body, &embedResponse)

	if error != nil {
		fmt.Println(error)
		return nil, error
	}

	// assert response to array
	slice, ok := embedResponse["embedding"].([]interface{})

	if !ok {
		fmt.Println(ok)
	}

	// assert to array of float64
	values := make([]float64, len(slice))

	for k, v := range slice {
		values[k] = float64(v.(float64))
	}

	return values, nil
}
```

</details>

Then send request or query to AOSS

<details>
<summary>QueryOpenSearch</summary>

```go
func QueryAOSS(vec []float64) ([]string, error) {

	// let query get all item in an index
	// content := strings.NewReader(`{
	//     "size": 10,
	//     "query": {
	//         "match_all": {}
	//         }
	// }`)

	vecStr := make([]string, len(vec))

	// convert array float to string
	for k, v := range vec {

		if k < len(vec)-1 {
			vecStr[k] = fmt.Sprint(v) + ","
		} else {
			vecStr[k] = fmt.Sprint(v)
		}

	}

	// create request body to titan model
	content := strings.NewReader(fmt.Sprintf(`{
		"size": 5,
		"query": {
			"knn": {
				"vector_field": {
					"vector": %s,
					"k": 5
				}
			}
		}
	}`, vecStr))

	// fmt.Println(content)

	search := opensearchapi.SearchRequest{
		Index: []string{"demo"},
		Body:  content,
	}

	searchResponse, err := search.Do(context.Background(), AOSSClient)

	if err != nil {
		log.Fatal(err)
	}

	// fmt.Println(searchResponse)

	var answer AossResponse

	json.NewDecoder(searchResponse.Body).Decode(&answer)

	// first := answer.Hits.Hits[0]

	// fmt.Printf("id: %s\n, index: %s\n, text: %s", first["_id"], first["_index"], first["_source"].(map[string]interface{})["text"])

	// fmt.Println(answer.Hits.Hits[0]["_id"])

	queryResult := answer.Hits.Hits[0]["_source"].(map[string]interface{})["text"]

	if queryResult == nil {
		return []string{"nil"}, nil
	}

	// extract hint text only
	hits := []string{}

	for k, v := range answer.Hits.Hits {

		if k > 0 {
			hits = append(hits, v["_source"].(map[string]interface{})["text"].(string))
		}

	}

	return hits, nil

	// return fmt.Sprint(queryResult), nil

}
```

</details>

## UserData

```go
#!/bin/bash
cd /home/ec2-user/
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
tar -xvf go1.21.5.linux-amd64.tar.gz
echo 'export PATH=/home/ec2-user/go/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
wget https://github.com/cdk-entest/golang-bedrock-demo/archive/refs/heads/main.zip
unzip main
cd golang-bedrock-demo-main
go mod tidy
go run .
```

## Config File

```ts
export const VPC_ID = "";
export const VPC_NAME = "";
export const REGION = "us-west-2";
export const BUCKET_ARN = "";
export const BUCKET_NAME = "";
export const AOSS_ARN = "";
export const GO_BLOG_ACM_CERT_ARN = "";
export const GO_BEDROCK_ACM_CERT_ARN = "";
export const ECR_REPO_NAME = "go-bedrock-app";
export const ARN_PRINCIPAL_ACCESS_AOSS = "";
export const AOSS_INDEX_NAME = "demo";
export const AOSS_DOMAIN = "";
export const AOSS_COLLECTION_ARN = "";
```
