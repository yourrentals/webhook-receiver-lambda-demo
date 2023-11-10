resource "aws_sqs_queue" "queue" {
  name = "webhook-receiver"
}

data "aws_iam_policy_document" "policy" {
  statement {
    effect = "Allow"
    resources = [
      aws_sqs_queue.queue.arn
    ]
    actions = ["sqs:SendMessage"]
  }

}

module "lambda" {
  source = "terraform-aws-modules/lambda/aws"

  function_name = "webhook-receiver"
  description   = "A lambda function that receives webhooks"
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  source_path = "./src"

  create_lambda_function_url = true

  environment_variables = {
    "PUBLIC_KEY" = file("./public_key.pem")
    "QUEUE_URL"  = aws_sqs_queue.queue.url
  }

  attach_policy_json = true
  policy_json        = data.aws_iam_policy_document.policy.json
}

output "url" {
  value = module.lambda.lambda_function_url
}
